const venueService = require('./venue.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const venue = await venueService.createVenue(req.body);
  sendSuccess(res, 201, venue, 'Venue created');
});

const getAll = asyncHandler(async (req, res) => {
  const venues = await venueService.getAllVenues(req.query);
  sendSuccess(res, 200, venues);
});

const getCities = asyncHandler(async (req, res) => {
  const cities = await venueService.getCities();
  sendSuccess(res, 200, cities);
});

const getById = asyncHandler(async (req, res) => {
  const venue = await venueService.getVenueById(req.params.id);
  sendSuccess(res, 200, venue);
});

const update = asyncHandler(async (req, res) => {
  const venue = await venueService.updateVenue(req.params.id, req.body);
  sendSuccess(res, 200, venue, 'Venue updated');
});

const remove = asyncHandler(async (req, res) => {
  await venueService.deleteVenue(req.params.id);
  sendSuccess(res, 200, null, 'Venue deleted');
});

module.exports = { create, getAll, getCities, getById, update, remove };
