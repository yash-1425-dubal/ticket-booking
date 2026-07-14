const prisma = require('../../config/prisma');

async function searchMovies(query, filters = {}) {
  if (!query || query.length < 2) return [];

  const where = {
    status: 'PUBLISHED',
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { category: { contains: query, mode: 'insensitive' } },
      { venue: { name: { contains: query, mode: 'insensitive' } } },
      { venue: { city: { contains: query, mode: 'insensitive' } } },
    ],
  };

  if (filters.city) {
    where.venue = { city: { contains: filters.city, mode: 'insensitive' } };
  }

  return prisma.movie.findMany({
    where,
    include: {
      venue: { select: { name: true, city: true } },
      events: {
        where: { status: 'SCHEDULED', startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

module.exports = { searchMovies };
