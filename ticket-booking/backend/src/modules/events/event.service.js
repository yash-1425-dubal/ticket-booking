const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

async function createEvent(data, userId) {
  const movie = await prisma.movie.findUnique({
    where: { id: data.movieId },
    include: { venue: true },
  });
  if (!movie) throw ApiError.notFound('Movie not found');
  if (movie.organizerId !== userId) throw ApiError.forbidden('Not your movie');

  const event = await prisma.event.create({
    data: {
      movieId: data.movieId,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      status: 'SCHEDULED',
    },
    include: { movie: { include: { venue: true } } },
  });

  // Auto-generate seats from venue layout
  const priceDefaults = { PREMIUM: 500.00, STANDARD: 300.00, ECONOMY: 180.00 };
  const seatPricing = data.seatPricing || {};

  const seats = [];
  for (let row = 1; row <= movie.venue.totalRows; row++) {
    for (let col = 1; col <= movie.venue.seatsPerRow; col++) {
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
  return event;
}

async function getEventById(id) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      movie: { include: { venue: true, organizer: { select: { id: true, name: true } } } },
      _count: { select: { seats: true, bookings: true } },
    },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

async function updateEvent(id, data, userId) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { movie: true },
  });
  if (!event) throw ApiError.notFound('Event not found');
  if (event.movie.organizerId !== userId) throw ApiError.forbidden('Not your movie');

  return prisma.event.update({
    where: { id },
    data: {
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.endTime && { endTime: new Date(data.endTime) }),
      ...(data.status && { status: data.status }),
    },
    include: { movie: { include: { venue: true } } },
  });
}

async function deleteEvent(id, userId) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { movie: true },
  });
  if (!event) throw ApiError.notFound('Event not found');
  if (event.movie.organizerId !== userId) throw ApiError.forbidden('Not your movie');

  return prisma.event.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

module.exports = { createEvent, getEventById, updateEvent, deleteEvent };
