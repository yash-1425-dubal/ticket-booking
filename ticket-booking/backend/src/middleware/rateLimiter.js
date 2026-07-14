const redis = require('../config/redis');
const ApiError = require('../utils/ApiError');

function rateLimiter(windowMs, maxRequests) {
  return async (req, res, next) => {
    if (!redis.isAvailable) return next();
    try {
      const key = `rate:${req.ip}:${req.path}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }
      if (current > maxRequests) {
        throw ApiError.tooMany('Too many requests, please try again later');
      }
      next();
    } catch (error) {
      if (error.isOperational) return next(error);
      next(error);
    }
  };
}

module.exports = rateLimiter;
