const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

async function idempotencyMiddleware(req, res, next) {
  if (req.method !== 'POST') return next();

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) return next();

  const userId = req.user?.id;
  if (!userId) return next();

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key: idempotencyKey } },
    });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        return res.status(existing.responseStatus).json(existing.responseBody);
      }
      throw ApiError.conflict('Request is already being processed');
    }

    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId,
        method: req.method,
        route: req.originalUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      await prisma.idempotencyKey.update({
        where: { userId_key: { userId, key: idempotencyKey } },
        data: {
          status: 'COMPLETED',
          responseStatus: res.statusCode,
          responseBody: body,
        },
      });
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = idempotencyMiddleware;
