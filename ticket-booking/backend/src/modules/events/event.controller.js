const eventService = require('./event.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body, req.user.id);
  sendSuccess(res, 201, event, 'Event created with seats');
});

const getById = asyncHandler(async (req, res) => {
  const event = await eventService.getEventById(req.params.id);
  sendSuccess(res, 200, event);
});

const update = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.id, req.body, req.user.id);
  sendSuccess(res, 200, event, 'Event updated');
});

const remove = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.params.id, req.user.id);
  sendSuccess(res, 200, null, 'Event cancelled');
});

module.exports = { create, getById, update, remove };
