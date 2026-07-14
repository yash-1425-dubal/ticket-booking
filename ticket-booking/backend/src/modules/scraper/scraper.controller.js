const scraperService = require('./scraper.service');
const { sendSuccess } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

function normalizeScraperResponse(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw?.data?.movies && Array.isArray(raw.data.movies)) return raw.data.movies;
  if (raw?.data?.items && Array.isArray(raw.data.items)) return raw.data.items;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  if (raw?.results && Array.isArray(raw.results)) return raw.results;
  if (raw?.items && Array.isArray(raw.items)) return raw.items;
  if (raw?.movies && Array.isArray(raw.movies)) return raw.movies;
  return [];
}

const getNowShowingMovies = asyncHandler(async (req, res) => {
  const { city } = req.query;
  if (!city) throw ApiError.badRequest('City parameter is required');
  const raw = await scraperService.getNowShowingMovies(city);
  sendSuccess(res, 200, normalizeScraperResponse(raw));
});

const getEventsList = asyncHandler(async (req, res) => {
  const { city } = req.query;
  if (!city) throw ApiError.badRequest('City parameter is required');
  const raw = await scraperService.getEventsList(city);
  sendSuccess(res, 200, normalizeScraperResponse(raw));
});

const getMovieDetails = asyncHandler(async (req, res) => {
  const { city, event_code } = req.query;
  if (!city || !event_code) throw ApiError.badRequest('City and event_code parameters are required');
  const data = await scraperService.getMovieDetails(city, event_code);
  sendSuccess(res, 200, data);
});

const refreshCache = asyncHandler(async (req, res) => {
  const { city, event_code } = req.query;
  if (!city) throw ApiError.badRequest('City parameter is required');
  const data = await scraperService.refreshNowShowingMovies(city, event_code);
  sendSuccess(res, 200, event_code ? data : normalizeScraperResponse(data));
});

const importMovie = asyncHandler(async (req, res) => {
  const { title, description, posterUrl, category, language, venueName, venueCity, eventDate, eventCode } = req.body;
  if (!title) throw ApiError.badRequest('Title is required');
  const result = await scraperService.importScraperMovie({ ...req.body, eventCode }, req.user.id);
  sendSuccess(res, 201, result);
});

module.exports = { getNowShowingMovies, getEventsList, getMovieDetails, refreshCache, importMovie };
