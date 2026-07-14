const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

async function createReview(userId, movieId, data) {
  // Check if movie exists
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw ApiError.notFound('Movie not found');

  // Check for existing review
  const existing = await prisma.review.findUnique({
    where: { userId_movieId: { userId, movieId } },
  });
  if (existing) throw ApiError.conflict('You already reviewed this movie');

  return prisma.review.create({
    data: { userId, movieId, rating: data.rating, comment: data.comment },
    include: { user: { select: { id: true, name: true } } },
  });
}

async function getMovieReviews(movieId) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw ApiError.notFound('Movie not found');

  const reviews = await prisma.review.findMany({
    where: { movieId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const avg = await prisma.review.aggregate({
    where: { movieId },
    _avg: { rating: true },
    _count: true,
  });

  return { reviews, averageRating: avg._avg.rating || 0, totalReviews: avg._count };
}

async function updateReview(userId, reviewId, data) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.userId !== userId) throw ApiError.forbidden('Not your review');

  return prisma.review.update({
    where: { id: reviewId },
    data,
    include: { user: { select: { id: true, name: true } } },
  });
}

async function deleteReview(userId, reviewId) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.userId !== userId) throw ApiError.forbidden('Not your review');

  await prisma.review.delete({ where: { id: reviewId } });
}

module.exports = { createReview, getMovieReviews, updateReview, deleteReview };
