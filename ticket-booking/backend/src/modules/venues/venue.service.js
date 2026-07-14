const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const INDIAN_CITIES = require('../../data/indian-cities');

async function createVenue(data) {
  return prisma.venue.create({ data });
}

async function getAllVenues(query = {}) {
  const where = {};
  if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
  return prisma.venue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { movies: true } } },
  });
}

async function getVenueById(id) {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: { _count: { select: { movies: true } } },
  });
  if (!venue) throw ApiError.notFound('Venue not found');
  return venue;
}

async function updateVenue(id, data) {
  await getVenueById(id);
  return prisma.venue.update({ where: { id }, data });
}

async function deleteVenue(id) {
  await getVenueById(id);
  return prisma.venue.delete({ where: { id } });
}

async function getCities() {
  return [...new Set(INDIAN_CITIES)];
}

module.exports = { createVenue, getAllVenues, getVenueById, updateVenue, deleteVenue, getCities };
