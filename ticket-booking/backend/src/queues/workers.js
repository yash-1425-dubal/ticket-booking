const { Worker } = require('bullmq');
const connection = require('./connection');
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

  // Email worker: Resend API only
  const emailWorker = new Worker('email', async (job) => {
    const { type, bookingId, userId, email, subject, html, attachments } = job.data;
    const recipient = email || userId;
    console.log(`Processing email job: ${type} for booking ${bookingId} -> ${recipient}`);

    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured in Railway Variables');
    }

    const result = await sendViaResendAPI({ to: recipient, subject, html, attachments });
    console.log(`Email sent via Resend API: ${result.id}`);

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
          subject: subject || 'Ticket Booking Update',
          html: html || `<p>Your booking (${bookingId}) has been ${type}.</p>`,
          attachments: attachments || [],
        });
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`Ethereal preview URL: ${previewUrl}`);
        console.log('>>> OPEN THIS URL TO VIEW TEST EMAIL <<<');
      } catch (e) {
        console.error('Ethereal fallback failed:', e.message);
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
