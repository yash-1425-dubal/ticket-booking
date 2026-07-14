const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const { invalidateCache } = require('../../config/systemConfig');

async function getAllUsers(query = {}) {
  const where = {};
  if (query.role) where.role = query.role;
  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, isEmailVerified: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function updateUserRole(userId, role) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (role === 'ADMIN') {
    throw ApiError.badRequest('Cannot assign ADMIN role');
  }
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });
}

async function deleteUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'ADMIN') {
    throw ApiError.badRequest('Cannot delete admin users');
  }
  return prisma.user.delete({ where: { id: userId } });
}

async function getAllBookings(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  return prisma.booking.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      show: { include: { event: { select: { title: true } } } },
      bookingSeats: { include: { seat: { select: { seatNumber: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

async function getAuditLogs(query = {}) {
  const where = {};
  if (query.action) where.action = query.action;
  if (query.userId) where.userId = query.userId;
  if (query.entityType) where.entityType = query.entityType;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getConfig(key) {
  if (key) {
    const entry = await prisma.systemConfig.findUnique({ where: { key } });
    return entry ? { [key]: entry.value } : {};
  }
  const all = await prisma.systemConfig.findMany();
  return Object.fromEntries(all.map(c => [c.key, c.value]));
}

async function updateConfig(key, value) {
  const entry = await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  invalidateCache();
  return { [entry.key]: entry.value };
}

module.exports = { getAllUsers, updateUserRole, deleteUser, getAllBookings, getAuditLogs, getConfig, updateConfig };
