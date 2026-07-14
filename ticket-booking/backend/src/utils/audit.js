const prisma = require('../config/prisma');

async function log(data) {
  try {
    await prisma.auditLog.create({ data });
  } catch {
    // silently fail - audit should never break the main flow
  }
}

function fromReq(req, action, entityType, entityId, metadata) {
  return log({
    userId: req.user?.id,
    action,
    entityType,
    entityId,
    metadata: metadata || undefined,
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  });
}

module.exports = { log, fromReq };
