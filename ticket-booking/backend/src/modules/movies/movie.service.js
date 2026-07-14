const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

async function createMovie(data, userId) {
  const venue = await prisma.venue.findUnique({ where: { id: data.venueId } });
  if (!venue) throw ApiError.notFound('Venue not found');

  return prisma.movie.create({
    data: { ...data, description: data.description || '', organizerId: userId },
    include: { venue: true },
  });
}

async function getAllMovies(query = {}) {
  const where = {};
  if (query.status) {
    where.status = query.status;
  } else {
    where.status = { not: 'CANCELLED' };
  }
  if (query.category) where.category = query.category;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.organizerId) where.organizerId = query.organizerId;
  if (query.city) {
    where.venue = { city: { contains: query.city, mode: 'insensitive' } };
  }

  return prisma.movie.findMany({
    where,
    include: {
      venue: true,
      organizer: { select: { id: true, name: true, email: true } },
      events: {
        where: { status: 'SCHEDULED', startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 10,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getMovieById(id) {
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: {
      venue: true,
      organizer: { select: { id: true, name: true, email: true } },
      events: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { startTime: 'asc' },
      },
    },
  });
  if (!movie) throw ApiError.notFound('Movie not found');
  return movie;
}

async function updateMovie(id, data, userId) {
  const movie = await getMovieById(id);
  if (movie.organizerId !== userId) throw ApiError.forbidden('Not your movie');
  return prisma.movie.update({ where: { id }, data, include: { venue: true } });
}

async function deleteMovie(id, userId) {
  const movie = await getMovieById(id);
  if (movie.organizerId !== userId) throw ApiError.forbidden('Not your movie');
  return prisma.movie.delete({ where: { id } });
}

async function getOrganizerMovies(userId, query = {}) {
  const where = { organizerId: userId };
  if (query.category) {
    if (query.category === 'MOVIES') {
      where.OR = [
        { category: 'MOVIES' },
        { category: null },
      ];
    } else {
      where.category = query.category;
    }
  }

  return prisma.movie.findMany({
    where,
    include: {
      venue: true,
      _count: { select: { events: true } },
      events: { orderBy: { startTime: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { createMovie, getAllMovies, getMovieById, updateMovie, deleteMovie, getOrganizerMovies };
