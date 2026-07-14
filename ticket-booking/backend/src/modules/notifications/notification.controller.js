const notificationService = require('./notification.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const getAll = asyncHandler(async (req, res) => {
  const notifications = await notificationService.getNotifications(req.user.id);
  sendSuccess(res, 200, notifications);
});

const markRead = asyncHandler(async (req, res) => {
  await notificationService.markAsRead(req.params.id, req.user.id);
  sendSuccess(res, 200, null, 'Marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  sendSuccess(res, 200, null, 'All marked as read');
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  sendSuccess(res, 200, { count });
});

module.exports = { getAll, markRead, markAllRead, unreadCount };
