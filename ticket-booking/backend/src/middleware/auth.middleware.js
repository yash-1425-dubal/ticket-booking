const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const safeUser = require('../utils/safeUser');

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired');
    }
    throw ApiError.unauthorized('Invalid token');
  }

  const userId = payload.userId || payload.id || payload.sub;
  if (!userId) {
    throw ApiError.unauthorized('Invalid token payload');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  req.user = safeUser(user);
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET);
    const userId = payload.userId || payload.id || payload.sub;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) req.user = safeUser(user);
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next();
});

module.exports = { authMiddleware, optionalAuth };
