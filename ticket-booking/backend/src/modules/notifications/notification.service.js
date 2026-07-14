const prisma = require('../../config/prisma');

async function getNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

async function markAsRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

async function getUnreadCount(userId) {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

module.exports = { getNotifications, markAsRead, markAllAsRead, getUnreadCount };
