const { Worker } = require('bullmq');
const connection = require('./connection');
const nodemailer = require('nodemailer');
const axios = require('axios');
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

  // SendGrid Web API sender (uses HTTPS, never blocked)
  async function sendViaSendGridAPI({ to, subject, html, attachments }) {
    const apiKey = env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('SENDGRID_API_KEY not set');

    const payload = {
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: env.SENDGRID_FROM_EMAIL || env.EMAIL_FROM, name: 'TicketBook' },
      content: [{ type: 'text/html', value: html }],
    };

    if (attachments?.length) {
      payload.attachments = attachments.map(a => ({
        content: a.content.toString('base64'),
        filename: a.filename,
        type: a.contentType || 'application/octet-stream',
        disposition: 'attachment',
      }));
    }

    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return response.data;
  }

  // Email worker: tries SendGrid API → SMTP (SendGrid or Gmail) → Ethereal
  const emailWorker = new Worker('email', async (job) => {
    const { type, bookingId, userId, email, subject, html, attachments } = job.data;
    const recipient = email || userId;
    console.log(`Processing email job: ${type} for booking ${bookingId} -> ${recipient}`);

    let sent = false;
    let messageId = null;
    let previewUrl = null;
    let lastError = null;

    // 1. Try SendGrid Web API (HTTPS, never blocked)
    if (env.SENDGRID_API_KEY) {
      try {
        await sendViaSendGridAPI({ to: recipient, subject, html, attachments });
        sent = true;
        messageId = `sendgrid-api-${Date.now()}`;
        console.log('Email sent via SendGrid Web API');
      } catch (err) {
        lastError = err;
        console.warn('SendGrid API failed:', err.message);
      }
    }

    // 2. Try SMTP (SendGrid SMTP or Gmail)
    if (!sent && (env.SMTP_USER && env.SMTP_PASS)) {
      let transporter;
      let useEthereal = false;
      let testAccount = null;

      try {
        const useSSL = env.SMTP_PORT === '465' || env.SMTP_SECURE === 'true';
        transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: parseInt(env.SMTP_PORT, 10) || 587,
          secure: useSSL,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });

        // Verify connection
        await transporter.verify();
        console.log('SMTP connection verified');

        const info = await transporter.sendMail({
          from: env.EMAIL_FROM,
          to: recipient,
          subject: subject || 'Ticket Booking Update',
          html: html || `<p>Your booking (${bookingId}) has been ${type}.</p>`,
          attachments: attachments || [],
        });

        sent = true;
        messageId = info.messageId;
        console.log(`Email sent via SMTP: ${info.messageId}`);
      } catch (smtpErr) {
        lastError = smtpErr;
        console.warn('SMTP send failed:', smtpErr.message);

        // Fallback to Ethereal
        try {
          testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
          });
          useEthereal = true;
          console.log(`Using Ethereal email: ${testAccount.user}`);
        } catch (etherealErr) {
          console.error('Ethereal fallback failed:', etherealErr.message);
        }
      }

      if (useEthereal && transporter) {
        try {
          const info = await transporter.sendMail({
            from: env.EMAIL_FROM,
            to: recipient,
            subject: subject || 'Ticket Booking Update',
            html: html || `<p>Your booking (${bookingId}) has been ${type}.</p>`,
            attachments: attachments || [],
          });
          sent = true;
          previewUrl = nodemailer.getTestMessageUrl(info);
          console.log(`Ethereal preview URL: ${previewUrl}`);
          console.log('>>> OPEN THIS URL TO VIEW TEST EMAIL <<<');
        } catch (e) {
          console.error('Ethereal send failed:', e.message);
        }
      }
    }

    // 3. Final Ethereal if nothing worked
    if (!sent) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        const info = await transporter.sendMail({
          from: env.EMAIL_FROM,
          to: recipient,
          subject: subject || 'Ticket Booking Update',
          html: html || `<p>Your booking (${bookingId}) has been ${type}.</p>`,
          attachments: attachments || [],
        });
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`Ethereal preview URL: ${previewUrl}`);
        console.log('>>> OPEN THIS URL TO VIEW TEST EMAIL <<<');
      } catch (e) {
        console.error('All email methods failed:', e.message);
        throw lastError || e;
      }
    }

    // Log email in database
    try {
      await prisma.emailLog.create({
        data: {
          userId,
          to: recipient,
          subject: subject || 'Ticket Booking Update',
          status: sent ? 'SENT' : 'ETHEREAL',
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
