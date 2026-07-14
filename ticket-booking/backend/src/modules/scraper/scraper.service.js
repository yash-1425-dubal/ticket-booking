const env = require('../../config/env');
const prisma = require('../../config/prisma');
const { getConfig } = require('../../config/systemConfig');

const PARSE_BASE_URL = env.PARSE_BASE_URL;
const TIMEOUT_MS = 60000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in DB

async function getApiKey() {
  return getConfig('PARSE_API_KEY');
}

async function getCached(type, city) {
  const slug = city.toLowerCase();
  const row = await prisma.scraperCache.findUnique({
    where: { city_type: { city: slug, type } },
  });
  if (!row) return null;
  if (Date.now() > row.expiresAt.getTime()) {
    await prisma.scraperCache.delete({ where: { id: row.id } });
    return null;
  }
  return row.data;
}

async function setCache(type, city, data) {
  const slug = city.toLowerCase();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.scraperCache.upsert({
    where: { city_type: { city: slug, type } },
    create: { city: slug, type, data, expiresAt },
    update: { data, expiresAt },
  });
}

async function getNowShowingMovies(city) {
  const slug = city.toLowerCase();

  // Check DB first — return stored data permanently
  const existing = await prisma.scraperCache.findUnique({
    where: { city_type: { city: slug, type: 'movies' } },
  });
  if (existing) return existing.data;

  const url = `${PARSE_BASE_URL}/get_recommended_movies?city=${encodeURIComponent(slug)}&limit=10`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': await getApiKey(),
        'API-Snapshot-Version': '7',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[Scraper] getNowShowingMovies returned ${res.status} for ${slug} — returning empty fallback`);
      return { results: [], status: 'error', message: `API returned ${res.status}` };
    }
    const data = await res.json();
    // Store permanently in DB
    await prisma.scraperCache.upsert({
      where: { city_type: { city: slug, type: 'movies' } },
      create: { city: slug, type: 'movies', data, expiresAt: new Date('2099-12-31') },
      update: { data, expiresAt: new Date('2099-12-31') },
    });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getEventsList(city) {
  const slug = city.toLowerCase();

  // Check DB cache first
  const cached = await getCached('events', slug);
  if (cached) return cached;

  const url = `${PARSE_BASE_URL}/get_events_list`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': await getApiKey(),
        'API-Snapshot-Version': '7',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ city: slug }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[Scraper] getEventsList returned ${res.status} for ${slug} — returning empty fallback`);
      return { results: [], status: 'error', message: `API returned ${res.status}` };
    }
    const data = await res.json();
    // Store in DB cache for all users
    await setCache('events', slug, data);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getMovieDetails(city, eventCode) {
  const slug = city.toLowerCase();
  const cacheType = `movie-details:${eventCode}`;

  // Check DB first — return stored data regardless of expiry, just refresh if stale
  const existing = await prisma.scraperCache.findUnique({
    where: { city_type: { city: slug, type: cacheType } },
  });
  if (existing) return existing.data;

  const url = `${PARSE_BASE_URL}/get_movie_details?city=${encodeURIComponent(slug)}&event_code=${encodeURIComponent(eventCode)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': await getApiKey(),
        'API-Snapshot-Version': '7',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[Scraper] getMovieDetails returned ${res.status} for ${slug}/${eventCode}`);
      return { status: 'error', message: `API returned ${res.status}` };
    }
    const data = await res.json();
    // Store permanently in DB — never expires, only updated on explicit refresh
    await prisma.scraperCache.upsert({
      where: { city_type: { city: slug, type: cacheType } },
      create: { city: slug, type: cacheType, data, expiresAt: new Date('2099-12-31') },
      update: { data, expiresAt: new Date('2099-12-31') },
    });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshNowShowingMovies(city, eventCode) {
  const slug = city.toLowerCase();

  // Delete existing cached entry
  if (eventCode) {
    const type = `movie-details:${eventCode}`;
    await prisma.scraperCache.deleteMany({ where: { city: slug, type } });
    // Re-fetch and store
    return getMovieDetails(city, eventCode);
  } else {
    await prisma.scraperCache.deleteMany({ where: { city: slug, type: 'movies' } });
    // Re-fetch and store
    return getNowShowingMovies(city);
  }
}

async function importScraperMovie(data, userId) {
  // Check if event already exists for this scraper movie (by event_code)
  if (data.eventCode) {
    const existingEvent = await prisma.event.findFirst({
      where: {
        movie: {
          ctaUrl: { contains: data.eventCode }
        }
      },
      include: { movie: { include: { venue: true } } },
    });
    if (existingEvent) {
      return { movieId: existingEvent.movieId, eventId: existingEvent.id, venueId: existingEvent.movie.venueId };
    }
  }

  // Find or create a venue
  const venueName = data.venueName || 'BookMyShow Venue';
  const venueCity = data.venueCity || 'Default City';
  let venue = await prisma.venue.findFirst({
    where: { name: venueName, city: venueCity },
  });
  if (!venue) {
    venue = await prisma.venue.create({
      data: { name: venueName, address: `${venueName}, ${venueCity}`, city: venueCity, totalRows: 10, seatsPerRow: 10 },
    });
  }

  // Use the authenticated user as the organizer
  const organizer = await prisma.user.findUnique({ where: { id: userId } });
  if (!organizer) throw new Error('Authenticated user not found');

  // Create the movie (store eventCode in ctaUrl for deduplication)
  const movie = await prisma.movie.create({
    data: {
      title: data.title,
      description: data.description || `${data.title} - Book your seats now!`,
      posterUrl: data.posterUrl || null,
      venueId: venue.id,
      organizerId: organizer.id,
      status: 'PUBLISHED',
      category: data.category || 'General',
      ctaUrl: data.eventCode ? `bms:${data.eventCode}` : null,
    },
  });

  // Create event with auto-generated seats — clamp year to ensure it's not stale
  let eventStart;
  if (data.eventDate) {
    eventStart = new Date(data.eventDate);
    if (isNaN(eventStart.getTime()) || eventStart.getFullYear() < 2024) {
      eventStart = new Date(Date.now() + 86400000);
    }
  } else {
    eventStart = new Date(Date.now() + 86400000);
  }
  const eventEnd = new Date(eventStart.getTime() + 3 * 60 * 60 * 1000);
  const event = await prisma.event.create({
    data: {
      movieId: movie.id,
      startTime: eventStart,
      endTime: eventEnd,
      status: 'SCHEDULED',
    },
  });

  // Auto-generate seats
  const priceDefaults = { PREMIUM: 500.00, STANDARD: 300.00, ECONOMY: 180.00 };
  const seatPricing = data.seatPricing || {};

  const seats = [];
  for (let row = 1; row <= venue.totalRows; row++) {
    for (let col = 1; col <= venue.seatsPerRow; col++) {
      const rowLabel = String.fromCharCode(64 + row);
      const category = row <= 3 ? 'PREMIUM' : row <= 6 ? 'STANDARD' : 'ECONOMY';
      const price = seatPricing[category] || priceDefaults[category];
      seats.push({
        eventId: event.id,
        seatNumber: `${rowLabel}-${col}`,
        row,
        col,
        category,
        price,
      });
    }
  }
  await prisma.seat.createMany({ data: seats });

  return { movieId: movie.id, eventId: event.id, venueId: venue.id };
}

module.exports = { getNowShowingMovies, getEventsList, getMovieDetails, importScraperMovie, refreshNowShowingMovies };
