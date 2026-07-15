const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

async function getMyEvents(organizerId, query = {}) {
  const { page = 1, limit = 10, status, search } = query;
  const skip = (page - 1) * limit;

  const where = { organizerId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { startTime: 'desc' },
      include: {
        movie: { select: { id: true, title: true, category: true } },
        venue: { select: { id: true, name: true, city: true } },
        _count: { select: { bookings: true, seats: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  // Add seat occupancy info
  const eventsWithStats = await Promise.all(events.map(async (event) => {
    const seatStats = await prisma.seat.groupBy({
      by: ['status'],
      where: { eventId: event.id },
      _count: { status: true },
    });
    const stats = { AVAILABLE: 0, HELD: 0, BOOKED: 0 };
    seatStats.forEach(s => { stats[s.status] = s._count.status; });
    return { ...event, seatStats };
  }));

  return {
    events: eventsWithStats,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getMyMovies(organizerId, query = {}) {
  const { page = 1, limit = 10, search } = query;
  const skip = (page - 1) * limit;

  const where = { organizerId };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        venue: { select: { id: true, name: true, city: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.movie.count({ where }),
  ]);

  return {
    movies,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getEventDetails(eventId, organizerId) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId },
    include: {
      movie: true,
      venue: true,
      seats: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
    },
  });

  if (!event) throw ApiError.notFound('Event not found');

  // Add seat statistics
  const seatStats = await prisma.seat.groupBy({
    by: ['status', 'category'],
    where: { eventId: event.id },
    _count: { status: true },
  });

  const stats = { AVAILABLE: 0, HELD: 0, BOOKED: 0, byCategory: {} };
  seatStats.forEach(s => {
    stats[s.status] += s._count.status;
    if (!stats.byCategory[s.category]) stats.byCategory[s.category] = { AVAILABLE: 0, HELD: 0, BOOKED: 0 };
    stats.byCategory[s.category][s.status] = s._count.status;
  });

  return { ...event, seatStats: stats };
}

async function getRevenueSummary(organizerId, query = {}) {
  const { from, to } = query;

  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const bookings = await prisma.booking.findMany({
    where: {
      event: { organizerId },
      status: { in: ['CONFIRMED', 'PENDING'] },
      createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    },
    select: {
      totalAmount: true,
      status: true,
      createdAt: true,
      seats: { select: { price: true, category: true } },
    },
  });

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const confirmedRevenue = bookings
    .filter(b => b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);

  const byCategory = {};
  bookings.forEach(b => {
    b.seats.forEach(s => {
      if (!byCategory[s.category]) byCategory[s.category] = { count: 0, revenue: 0 };
      byCategory[s.category].count++;
      byCategory[s.category].revenue += Number(s.price);
    });
  });

  return {
    totalRevenue,
    confirmedRevenue,
    totalBookings: bookings.length,
    confirmedBookings: bookings.filter(b => b.status === 'CONFIRMED').length,
    byCategory,
  };
}

module.exports = { getMyEvents, getMyMovies, getEventDetails, getRevenueSummary };