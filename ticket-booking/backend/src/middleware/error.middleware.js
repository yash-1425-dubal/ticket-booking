const ApiError = require('../utils/ApiError');
const { ZodError } = require('zod');

function errorMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: (err.errors || err.issues || []).map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

module.exports = errorMiddleware;
