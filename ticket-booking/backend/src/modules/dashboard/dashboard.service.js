const prisma = require('../../config/prisma');

async function getOrganizerDashboard(userId) {
  const [movies, totalBookings, totalRevenue, cancelledBookings] = await Promise.all([
    prisma.movie.findMany({
      where: { organizerId: userId },
      include: {
        venue: true,
        _count: { select: { events: true } },
      },
    }),
    prisma.booking.count({
      where: {
        event: { movie: { organizerId: userId } },
        status: 'CONFIRMED',
      },
    }),
    prisma.booking.aggregate({
      where: {
        event: { movie: { organizerId: userId } },
        status: 'CONFIRMED',
      },
      _sum: { totalAmount: true },
    }),
    prisma.booking.count({
      where: {
        event: { movie: { organizerId: userId } },
        status: 'CANCELLED',
      },
    }),
  ]);

  const totalSeats = await prisma.seat.count({
    where: { event: { movie: { organizerId: userId } } },
  });

  const bookedSeats = await prisma.seat.count({
    where: {
      event: { movie: { organizerId: userId } },
      status: 'BOOKED',
    },
  });

  const waitlistCount = await prisma.waitlistEntry.count({
    where: {
      event: { movie: { organizerId: userId } },
      status: 'WAITING',
    },
  });

  // Per-movie breakdown: bookings and revenue
  const movieIds = movies.map(m => m.id);
  const perMovieData = await Promise.all(movieIds.map(async (movieId) => {
    const [bookings, revenue, available, booked] = await Promise.all([
      prisma.booking.count({ where: { event: { movie: { id: movieId } }, status: 'CONFIRMED' } }),
      prisma.booking.aggregate({ where: { event: { movie: { id: movieId } }, status: 'CONFIRMED' }, _sum: { totalAmount: true } }),
      prisma.seat.count({ where: { event: { movie: { id: movieId } }, status: 'AVAILABLE' } }),
      prisma.seat.count({ where: { event: { movie: { id: movieId } }, status: 'BOOKED' } }),
    ]);
    return { movieId, bookings, revenue: revenue._sum.totalAmount || 0, availableSeats: available, bookedSeats: booked };
  }));

  const perMovieMap = Object.fromEntries(perMovieData.map(d => [d.movieId, d]));
  const moviesWithStats = movies.map(movie => ({
    ...movie,
    bookings: perMovieMap[movie.id]?.bookings || 0,
    revenue: perMovieMap[movie.id]?.revenue || 0,
    availableSeats: perMovieMap[movie.id]?.availableSeats || 0,
    bookedSeats: perMovieMap[movie.id]?.bookedSeats || 0,
  }));

  return {
    eventsCount: movies.length,
    events: moviesWithStats,
    totalBookings,
    totalRevenue: totalRevenue._sum.totalAmount || 0,
    cancelledBookings,
    occupancyRate: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
    availableSeats: totalSeats - bookedSeats,
    waitlistCount,
  };
}

async function getAdminDashboard() {
  const [users, movies, events, venues, bookings, seats, payments, notifications, scraperCache, waitlistEntries] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: 'desc' } }),
    prisma.movie.findMany({ orderBy: { id: 'desc' } }),
    prisma.event.findMany({ orderBy: { id: 'desc' } }),
    prisma.venue.findMany({ orderBy: { id: 'desc' } }),
    prisma.booking.findMany({ orderBy: { id: 'desc' } }),
    prisma.seat.findMany({ orderBy: { id: 'desc' } }),
    prisma.payment.findMany({ orderBy: { id: 'desc' } }),
    prisma.notification.findMany({ orderBy: { id: 'desc' } }),
    prisma.scraperCache.findMany({ orderBy: { id: 'desc' } }),
    prisma.waitlistEntry.findMany({ orderBy: { id: 'desc' } }),
  ]);

  return {
    users,
    movies,
    events,
    venues,
    bookings,
    seats,
    payments,
    notifications,
    scraperCache,
    waitlistEntries,
  };
}

module.exports = { getOrganizerDashboard, getAdminDashboard };
