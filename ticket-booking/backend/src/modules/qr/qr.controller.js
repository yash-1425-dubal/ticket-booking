const qrService = require('./qr.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const getQr = asyncHandler(async (req, res) => {
  const result = await qrService.generateQrImage(req.params.bookingId);
  sendSuccess(res, 200, result);
});

const verify = asyncHandler(async (req, res) => {
  const result = await qrService.verifyTicket(req.params.bookingId, req.query.token);
  sendSuccess(res, 200, result);
});

module.exports = { getQr, verify };
