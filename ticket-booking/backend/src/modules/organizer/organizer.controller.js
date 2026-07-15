const service = require('./organizer.service');
const asyncHandler = require('../../utils/asyncHandler');

const getMyEvents = asyncHandler(async (req, res) => {
  const result = await service.getMyEvents(req.user.id, req.query);
  res.json(result);
});

const getMyMovies = asyncHandler(async (req, res) => {
  const result = await service.getMyMovies(req.user.id, req.query);
  res.json(result);
});

const getEventDetails = asyncHandler(async (req, res) => {
  const event = await service.getEventDetails(req.params.id, req.user.id);
  res.json(event);
});

const getRevenueSummary = asyncHandler(async (req, res) => {
  const summary = await service.getRevenueSummary(req.user.id, req.query);
  res.json(summary);
});

module.exports = { getMyEvents, getMyMovies, getEventDetails, getRevenueSummary };