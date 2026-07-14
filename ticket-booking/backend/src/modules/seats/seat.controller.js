const seatService = require('./seat.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const getMap = asyncHandler(async (req, res) => {
  const result = await seatService.getSeatMap(req.params.eventId);
  sendSuccess(res, 200, result);
});

const hold = asyncHandler(async (req, res) => {
  const result = await seatService.holdSeats(req.params.eventId, req.body.seatIds, req.user.id);
  sendSuccess(res, 200, result, 'Seats held');
});

const release = asyncHandler(async (req, res) => {
  const result = await seatService.releaseSeats(req.params.eventId, req.body.seatIds, req.user.id);
  sendSuccess(res, 200, result, 'Seats released');
});

module.exports = { getMap, hold, release };
