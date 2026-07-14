function sendSuccess(res, statusCode = 200, data = null, message = 'Success') {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
}

function sendPaginated(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data,
    pagination,
  });
}

function sendError(res, statusCode, message, details = null) {
  const response = { success: false, message };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
}

module.exports = { sendSuccess, sendPaginated, sendError };
