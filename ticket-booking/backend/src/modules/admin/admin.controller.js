const adminService = require('./admin.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const env = require('../../config/env');
const prisma = require('../../config/prisma');

// Shared 3-tier email sender: Resend API → SMTP → Ethereal fallback
async function sendDiagnosticEmail({ to, subject, html, attachments }) {
  if (env.RESEND_API_KEY) {
    const axios = require('axios');
    const payload = {
      from: env.RESEND_FROM_EMAIL || 'TicketBook <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })) || [],
    };
    const response = await axios.post('https://api.resend.com/emails', payload, {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log(`[TestEmail] Sent via Resend API: ${response.data.id}`);
    return 'Sent via Resend API';
  }

  if (env.BREVO_API_KEY) {
    const axios = require('axios');
    const payload = {
      sender: { email: env.EMAIL_FROM || 'noreply@ticketbooking.com', name: 'TicketBook' },
      to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
      subject,
      htmlContent: html,
      attachment: attachments?.map(a => ({ name: a.filename, content: a.content.toString('base64') })) || [],
    };
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log(`[TestEmail] Sent via Brevo API: ${response.data.messageId}`);
    return 'Sent via Brevo API';
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM || `"TicketBook" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`[TestEmail] Sent via SMTP: ${info.messageId}`);
    return 'Sent via SMTP';
  }

  const nodemailer = require('nodemailer');
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email', port: 587, secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  const info = await transporter.sendMail({
    from: '"TicketBook Dev" <dev@ticketbook.local>', to, subject, html, attachments,
  });
  console.log(`[TestEmail] Sent via Ethereal: ${info.messageId} — ${nodemailer.getTestMessageUrl(info)}`);
  return `Sent via Ethereal — ${nodemailer.getTestMessageUrl(info)}`;
}

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

  const configStatus = {
    resendConfigured: !!env.RESEND_API_KEY,
    resendFrom: env.RESEND_FROM_EMAIL || '(not set)',
    brevoConfigured: !!env.BREVO_API_KEY,
    smtpConfigured: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    smtpHost: env.SMTP_HOST || '(not set)',
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER ? env.SMTP_USER.substring(0, 4) + '...' : '(not set)',
    emailFrom: env.EMAIL_FROM,
  };

  let result, recentLogs = [], redisAvailable = false, queueJobCounts = null;

  try {
    result = await sendDiagnosticEmail({
      to,
      subject: 'Test Email from TicketBook',
      html: '<h2>Test Email</h2><p>If you receive this, email delivery is working correctly!</p>',
    });
  } catch (err) {
    result = `Send failed: ${err.message}`;
  }

  try {
    recentLogs = await prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, to: true, subject: true, status: true, createdAt: true } });
  } catch (e) {
    recentLogs = [{ error: e.message }];
  }

  try {
    const { getQueue } = require('../../queues/queues');
    const emailQueue = getQueue('email');
    redisAvailable = !!emailQueue;
    if (emailQueue) queueJobCounts = await emailQueue.getJobCounts();
  } catch {}

  sendSuccess(res, 200, { configStatus, result, recentLogs, redisAvailable, queueJobCounts });
});

const emailConfig = asyncHandler(async (req, res) => {
  let smtpVerify = 'not tested';
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
      await transporter.verify();
      smtpVerify = 'OK';
    } catch (err) {
      smtpVerify = `FAILED: ${err.message}`;
    }
  }
  const configStatus = {
    resendConfigured: !!env.RESEND_API_KEY,
    brevoConfigured: !!env.BREVO_API_KEY,
    smtpConfigured: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    smtpHost: env.SMTP_HOST || '(not set)',
    smtpPort: env.SMTP_PORT,
    smtpUserPrefix: env.SMTP_USER ? env.SMTP_USER.substring(0, 4) + '...' : '(not set)',
    emailFrom: env.EMAIL_FROM,
    smtpVerify,
  };
  let recentLogs = [];
  try {
    recentLogs = await prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, to: true, subject: true, status: true, createdAt: true } });
  } catch {}
  sendSuccess(res, 200, { configStatus, recentLogs });
});

module.exports = { getUsers, updateRole, removeUser, getBookings, getAuditLogs, getConfig, updateConfig, testEmail, emailConfig };
