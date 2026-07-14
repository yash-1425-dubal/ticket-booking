const waitlistService = require('./waitlist.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const join = asyncHandler(async (req, res) => {
  const entry = await waitlistService.joinWaitlist(req.body.eventId, req.body.category, req.user.id);
  sendSuccess(res, 201, entry, 'Added to waitlist');
});

const status = asyncHandler(async (req, res) => {
  const entries = await waitlistService.getWaitlistStatus(req.params.eventId, req.user.id);
  sendSuccess(res, 200, entries);
});

const leave = asyncHandler(async (req, res) => {
  const result = await waitlistService.leaveWaitlist(req.params.eventId, req.body.category, req.user.id);
  sendSuccess(res, 200, result);
});

const getMyEntries = asyncHandler(async (req, res) => {
  const entries = await waitlistService.getMyWaitlists(req.user.id);
  sendSuccess(res, 200, entries);
});

const cancelEntry = asyncHandler(async (req, res) => {
  const result = await waitlistService.cancelWaitlistEntry(req.params.id, req.user.id);
  sendSuccess(res, 200, result);
});

module.exports = { join, status, leave, getMyEntries, cancelEntry };
