const { Worker } = require('bullmq');
const connection = require('./connection');
const axios = require('axios');
const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { releaseExpiredHolds } = require('../modules/seats/seat.service');
const { expireOffer } = require('../modules/waitlist/waitlist.service');

async function setupWorkers() {
  if (!connection.isReady) {
    console.warn('Redis unavailable, background workers disabled');
    return;
  }

  const conn = connection.client;

  // Resend API sender (HTTPS, never blocked, 3k/month free)
  async function sendViaResendAPI({ to, subject, html, attachments }) {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not set');

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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return response.data;
  }

  // Real SMTP transporter (Gmail, Brevo, Outlook, etc.)
  let smtpTransporter = null;
  function getSmtpTransporter() {
    if (smtpTransporter) return smtpTransporter;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      return null;
    }
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === '465', // true for 465, false for 587
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    console.log('📧 SMTP transporter configured:', env.SMTP_HOST);
    return smtpTransporter;
  }

  // Ethereal.email fallback for development (fake SMTP, completely free, no domain needed)
  let etherealTransporter = null;
  async function getEtherealTransporter() {
    if (etherealTransporter) return etherealTransporter;
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('📧 Ethereal test account created:', testAccount.user);
    console.log('📧 View emails at: https://ethereal.email');
    return etherealTransporter;
  }

  // Email worker: Resend API (prod) → Real SMTP → Ethereal (dev)
  const emailWorker = new Worker('email', async (job) => {
    const { type, bookingId, userId, email, subject, html, attachments } = job.data;
    const recipient = email || userId;
    console.log(`Processing email job: ${type} for booking ${bookingId} -> ${recipient}`);

    if (env.RESEND_API_KEY) {
      // Priority 1: Resend API (production, HTTPS, no port issues)
      const result = await sendViaResendAPI({ to: recipient, subject, html, attachments });
      console.log(`Email sent via Resend API: ${result.id}`);
    } else {
      // Priority 2: Real SMTP (Gmail, Brevo, Outlook, etc.)
      const smtpTransporter = getSmtpTransporter();
      if (smtpTransporter) {
        const info = await smtpTransporter.sendMail({
          from: env.EMAIL_FROM || `"TicketBook" <${env.SMTP_USER}>`,
          to: recipient,
          subject,
          html,
          attachments: attachments?.map(a => ({
            filename: a.filename,
            content: a.content,
          })) || [],
        });
        console.log(`📧 Email sent via SMTP: ${info.messageId}`);
      } else {
        // Priority 3: Ethereal.email (fake inbox for dev)
        const transporter = await getEtherealTransporter();
        const info = await transporter.sendMail({
          from: '"TicketBook Dev" <dev@ticketbook.local>',
          to: recipient,
          subject,
          html,
          attachments: attachments?.map(a => ({
            filename: a.filename,
            content: a.content,
          })) || [],
        });
        console.log(`📧 Ethereal email sent: ${info.messageId}`);
        console.log(`📧 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    }

    // Log email in database
    try {
      await prisma.emailLog.create({
        data: {
          userId,
          to: recipient,
          subject: subject || 'Ticket Booking Update',
          status: 'SENT',
          bookingId,
        },
      });
    } catch {}
  }, { connection: conn });

  // Waitlist worker (offer expiry)
  const waitlistWorker = new Worker('waitlist', async (job) => {
    if (job.name === 'offer-expiry') {
      const { eventId, seatId, userId } = job.data;
      console.log(`Expiring waitlist offer for seat ${seatId}`);
      await expireOffer(eventId, seatId, userId);
    }
  }, { connection: conn });

  // Seat cleanup worker (release expired holds)
  const seatCleanupWorker = new Worker('seat-cleanup', async () => {
    const released = await releaseExpiredHolds();
    if (released > 0) {
      console.log(`Released ${released} expired seat holds`);
    }
  }, { connection: conn });

  // Run seat cleanup every 30 seconds
  const { getQueue } = require('./queues');
  const cleanupQueue = getQueue('seat-cleanup');
  if (cleanupQueue) {
    await cleanupQueue.upsertJobScheduler('seat-cleanup-scheduler', {
      every: 30000,
    }, {
      name: 'cleanup-expired-holds',
    });
  }

  console.log('Workers initialized');
}

module.exports = { setupWorkers };