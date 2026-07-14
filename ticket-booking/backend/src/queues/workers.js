const { Worker } = require('bullmq');
const connection = require('./connection');
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

  // Email worker
  const emailWorker = new Worker('email', async (job) => {
    const { type, bookingId, userId, email, subject, html, attachments } = job.data;
    const recipient = email || userId;
    console.log(`Processing email job: ${type} for booking ${bookingId} -> ${recipient}`);

    let transporter;
    let useEthereal = false;

    if (env.SMTP_USER && env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: false,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    } else {
      useEthereal = true;
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log(`Using Ethereal email: ${testAccount.user}`);
    }

    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: recipient,
      subject: subject || 'Ticket Booking Update',
      html: html || `<p>Your booking (${bookingId}) has been ${type}.</p>`,
      attachments: attachments || [],
    });

    if (useEthereal) {
      console.log(`Ethereal preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    } else {
      console.log(`Email sent: ${info.messageId}`);
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
