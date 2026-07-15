const adminService = require('./admin.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const env = require('../../config/env');
const prisma = require('../../config/prisma');

const getUsers = asyncHandler(async (req, res) => {
  const users = await adminService.getAllUsers(req.query);
  sendSuccess(res, 200, users);
});

const updateRole = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserRole(req.params.id, req.body.role);
  sendSuccess(res, 200, user, 'User role updated');
});

const removeUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.params.id);
  sendSuccess(res, 200, null, 'User deleted');
});

const getBookings = asyncHandler(async (req, res) => {
  const bookings = await adminService.getAllBookings(req.query);
  sendSuccess(res, 200, bookings);
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await adminService.getAuditLogs(req.query);
  sendSuccess(res, 200, result);
});

const getConfig = asyncHandler(async (req, res) => {
  const { key } = req.query;
  const config = await adminService.getConfig(key);
  sendSuccess(res, 200, config);
});

const updateConfig = asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) return sendSuccess(res, 400, null, 'Key is required');
  const result = await adminService.updateConfig(key, value);
  sendSuccess(res, 200, result, 'Config updated');
});

const testEmail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return sendSuccess(res, 400, null, 'Recipient email is required');

  // Show what's configured
  const configStatus = {
    resendConfigured: !!env.RESEND_API_KEY,
    smtpConfigured: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    smtpHost: env.SMTP_HOST || '(not set)',
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER ? env.SMTP_USER.substring(0, 4) + '...' : '(not set)',
    emailFrom: env.EMAIL_FROM,
  };

  // Try sending using the same 3-tier logic
  const { sendEmail } = require('../bookings/booking.service');
  try {
    await sendEmail({
      to,
      subject: 'Test Email from TicketBook',
      html: '<h2>Test Email</h2><p>If you receive this, email delivery is working correctly!</p>',
    });
    configStatus.result = 'Email sent successfully';
  } catch (err) {
    configStatus.result = `Email send failed: ${err.message}`;
  }

  // Check recent email logs
  try {
    const recentLogs = await prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    configStatus.recentLogs = recentLogs;
  } catch {
    configStatus.recentLogs = [];
  }

  // Check queue status
  try {
    const { getQueue } = require('../../queues/queues');
    const emailQueue = getQueue('email');
    configStatus.redisAvailable = !!emailQueue;
    if (emailQueue) {
      const jobCounts = await emailQueue.getJobCounts();
      configStatus.queueJobCounts = jobCounts;
    }
  } catch {
    configStatus.redisAvailable = false;
  }

  sendSuccess(res, 200, configStatus);
});

module.exports = { getUsers, updateRole, removeUser, getBookings, getAuditLogs, getConfig, updateConfig, testEmail };
