const movieService = require('./movie.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const movie = await movieService.createMovie(req.body, req.user.id);
  sendSuccess(res, 201, movie, 'Movie created');
});

const getAll = asyncHandler(async (req, res) => {
  const movies = await movieService.getAllMovies(req.query);
  sendSuccess(res, 200, movies);
});

const getById = asyncHandler(async (req, res) => {
  const movie = await movieService.getMovieById(req.params.id);
  sendSuccess(res, 200, movie);
});

const update = asyncHandler(async (req, res) => {
  const movie = await movieService.updateMovie(req.params.id, req.body, req.user.id);
  sendSuccess(res, 200, movie, 'Movie updated');
});

const remove = asyncHandler(async (req, res) => {
  await movieService.deleteMovie(req.params.id, req.user.id);
  sendSuccess(res, 200, null, 'Movie deleted');
});

const getMyMovies = asyncHandler(async (req, res) => {
  const movies = await movieService.getOrganizerMovies(req.user.id, req.query);
  sendSuccess(res, 200, movies);
});

module.exports = { create, getAll, getById, update, remove, getMyMovies };
