const reviewService = require('./review.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.user.id, req.params.movieId, req.body);
  sendSuccess(res, 201, review, 'Review created');
});

const getMovieReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.getMovieReviews(req.params.movieId);
  sendSuccess(res, 200, result);
});

const update = asyncHandler(async (req, res) => {
  const review = await reviewService.updateReview(req.user.id, req.params.id, req.body);
  sendSuccess(res, 200, review, 'Review updated');
});

const remove = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.user.id, req.params.id);
  sendSuccess(res, 200, null, 'Review deleted');
});

module.exports = { create, getMovieReviews, update, remove };
