const bookingService = require('./booking.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(
    req.params.eventId,
    req.body.seatIds,
    req.user.id,
    req.headers['idempotency-key'] || null
  );
  sendSuccess(res, 201, booking, 'Booking confirmed');
});

const getAll = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getUserBookings(req.user.id);
  sendSuccess(res, 200, bookings);
});

const getById = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingById(req.params.id, req.user.id);
  sendSuccess(res, 200, booking);
});

const cancel = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.params.id, req.user.id, req.body.reason);
  sendSuccess(res, 200, booking, 'Booking cancelled');
});

module.exports = { create, getAll, getById, cancel };
