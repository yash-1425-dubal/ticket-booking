const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const axios = require('axios');

const OFFER_TTL = env.WAITLIST_OFFER_TTL_MINUTES * 60 * 1000;

async function sendViaResendAPI({ to, subject, html }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const payload = {
    from: env.RESEND_FROM_EMAIL || 'TicketBook <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  await axios.post('https://api.resend.com/emails', payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

async function trySendEmail(jobData) {
  const { getQueue } = require('../../queues/queues');
  const emailQueue = getQueue('email');
  if (emailQueue) {
    try {
      await emailQueue.add(jobData.type || 'email', jobData);
      return;
    } catch {}
  }
  // Fallback: direct Resend API call
  await sendViaResendAPI({
    to: jobData.email,
    subject: jobData.subject,
    html: jobData.html,
  });
}

async function joinWaitlist(eventId, category, userId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { movie: { select: { title: true } } },
  });
  if (!event) throw ApiError.notFound('Event not found');

  // Check if user already has a waitlist entry for this event/category
  const existing = await prisma.waitlistEntry.findUnique({
    where: { userId_eventId_category: { userId, eventId, category } },
  });
  if (existing) {
    if (existing.status === 'WAITING') {
      throw ApiError.conflict('You are already on the waitlist for this category');
    }
    // Remove expired entry so user can rejoin
    await prisma.waitlistEntry.delete({ where: { id: existing.id } });
  }

  // Get next position
  const lastEntry = await prisma.waitlistEntry.findFirst({
    where: { eventId, category, status: 'WAITING' },
    orderBy: { position: 'desc' },
  });

  const position = (lastEntry?.position || 0) + 1;

  const entry = await prisma.waitlistEntry.create({
    data: {
      userId,
      eventId,
      category,
      position,
      status: 'WAITING',
    },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'WAITLIST_JOINED',
      title: 'Added to Waitlist',
      message: `You are #${position} on the waitlist for ${category} tickets.`,
    },
  });

  // Notify user via socket
  try {
    const { getSocketServer } = require('../../sockets');
    const io = getSocketServer();
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        type: 'WAITLIST_JOINED',
        title: 'Added to Waitlist',
        message: `You are #${position} on the waitlist for ${category} tickets.`,
      });
    }
  } catch {}

  // Send email notification (non-blocking)
  setImmediate(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      const movieTitle = event.movie?.title || 'Movie';
      await trySendEmail({
        type: 'waitlist-joined',
        userId,
        email: user?.email || userId,
        subject: `Added to Waitlist - ${movieTitle}`,
        html: `<h2>Waitlist Joined</h2><p>Hi ${user?.name || 'there'},</p><p>You are #${position} on the waitlist for <strong>${category}</strong> tickets at <strong>${movieTitle}</strong>.</p><p>We'll notify you when seats become available.</p>`,
      });
    } catch {}
  });

  return entry;
}

async function getWaitlistStatus(eventId, userId) {
  return prisma.waitlistEntry.findMany({
    where: { eventId, userId },
    orderBy: { category: 'asc' },
  });
}

async function leaveWaitlist(eventId, category, userId) {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { userId_eventId_category: { userId, eventId, category } },
  });

  if (!entry || entry.status !== 'WAITING') {
    throw ApiError.notFound('Waitlist entry not found');
  }

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: 'CANCELLED' },
  });

  return { message: 'Removed from waitlist' };
}

async function getMyWaitlists(userId) {
  return prisma.waitlistEntry.findMany({
    where: { userId },
    include: {
      event: {
        include: {
          movie: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function cancelWaitlistEntry(entryId, userId) {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) {
    throw ApiError.notFound('Waitlist entry not found');
  }
  if (entry.status !== 'WAITING') {
    throw ApiError.badRequest('Can only cancel WAITING entries');
  }
  return prisma.waitlistEntry.update({
    where: { id: entryId },
    data: { status: 'CANCELLED' },
  });
}

async function promoteWaitlist(eventId, seatId) {
  // Get the seat to determine its category
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) return;

  // Find the first waiting user for this category
  const nextEntry = await prisma.waitlistEntry.findFirst({
    where: {
      eventId,
      category: seat.category,
      status: 'WAITING',
    },
    orderBy: { position: 'asc' },
  });

  if (!nextEntry) return;

  // Promote this entry
  await prisma.waitlistEntry.update({
    where: { id: nextEntry.id },
    data: { status: 'PROMOTED' },
  });

  // Create notification
  await prisma.notification.create({
    data: {
      userId: nextEntry.userId,
      type: 'WAITLIST_PROMOTED',
      title: 'Seats Available!',
      message: `Good news! ${seat.category} seats are now available for your waitlisted event. You have ${env.WAITLIST_OFFER_TTL_MINUTES} minutes to book.`,
    },
  });

  // Notify user via socket
  try {
    const { getSocketServer } = require('../../sockets');
    const io = getSocketServer();
    if (io) {
      io.to(`user:${nextEntry.userId}`).emit('notification', {
        type: 'WAITLIST_PROMOTED',
        title: 'Seats Available!',
        message: `Good news! ${seat.category} seats are now available. You have ${env.WAITLIST_OFFER_TTL_MINUTES} minutes to book.`,
      });
    }
  } catch {}

  // Send email notification
  try {
    const user = await prisma.user.findUnique({ where: { id: nextEntry.userId }, select: { email: true, name: true } });
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { movie: { select: { id: true, title: true } } },
    });
    const movieTitle = event?.movie?.title || 'Movie';
    const movieId = event?.movie?.id || '';
    const bookingLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/movies/${movieId}/book?eventId=${eventId}`;
    await trySendEmail({
      type: 'waitlist-promoted',
      userId: nextEntry.userId,
      email: user?.email || nextEntry.userId,
      subject: `Seats Available - ${movieTitle}`,
      html: `<h2>Seats Now Available!</h2><p>Hi ${user?.name || 'there'},</p><p>Good news! <strong>${seat.category}</strong> seats are now available for <strong>${movieTitle}</strong>.</p><p>You have <strong>${env.WAITLIST_OFFER_TTL_MINUTES} minutes</strong> to book your seats.</p><p><a href="${bookingLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Book Now</a></p><p>This offer expires in ${env.WAITLIST_OFFER_TTL_MINUTES} minutes.</p>`,
    });
  } catch {}

  // Reserve the seat for this user temporarily
  const now = new Date();
  await prisma.seat.update({
    where: { id: seatId },
    data: {
      status: 'HELD',
      heldBy: nextEntry.userId,
      heldAt: now,
      version: { increment: 1 },
    },
  });

  // Broadcast waitlist promotion
  try {
    const { getSocketServer } = require('../../sockets');
    const io = getSocketServer();
    if (io) {
      const expiresAt = new Date(Date.now() + OFFER_TTL).toISOString();
      io.to(`event:${eventId}`).emit('waitlistPromoted', {
        eventId,
        userId: nextEntry.userId,
        category: seat.category,
        seatIds: [seatId],
        expiresAt,
      });
    }
  } catch {}

  // Schedule expiry for the offer
  try {
    const { getQueue } = require('../../queues/queues');
    const waitlistQueue = getQueue('waitlist');
    if (waitlistQueue) {
      await waitlistQueue.add(
        'offer-expiry',
        { eventId, seatId, userId: nextEntry.userId },
        { delay: OFFER_TTL }
      );
    }
  } catch {}
}

async function expireOffer(eventId, seatId, userId) {
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat || seat.status !== 'HELD' || seat.heldBy !== userId) return;

  // Release the seat
  await prisma.seat.update({
    where: { id: seatId },
    data: {
      status: 'AVAILABLE',
      heldBy: null,
      heldAt: null,
      version: { increment: 1 },
    },
  });

  // Update waitlist entry to EXPIRED
  try {
    const existingEntry = await prisma.waitlistEntry.findFirst({
      where: { eventId, userId, category: seat.category, status: 'PROMOTED' },
    });
    if (existingEntry) {
      await prisma.waitlistEntry.update({
        where: { id: existingEntry.id },
        data: { status: 'EXPIRED' },
      });
    }
  } catch {}

  // Notify user
  await prisma.notification.create({
    data: {
      userId,
      type: 'WAITLIST_EXPIRED',
      title: 'Offer Expired',
      message: 'Your offer for waitlisted seats has expired.',
    },
  });

  // Notify user via socket
  try {
    const { getSocketServer } = require('../../sockets');
    const io = getSocketServer();
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        type: 'WAITLIST_EXPIRED',
        title: 'Offer Expired',
        message: 'Your offer for waitlisted seats has expired.',
      });
    }
  } catch {}

  // Broadcast seat released
  try {
    const { getSocketServer } = require('../../sockets');
    const io = getSocketServer();
    if (io) {
      io.to(`event:${eventId}`).emit('seatReleased', {
        eventId,
        seatIds: [seatId],
      });
    }
  } catch {}

  // Promote next in line
  await promoteWaitlist(eventId, seatId);
}

module.exports = { joinWaitlist, getWaitlistStatus, leaveWaitlist, getMyWaitlists, cancelWaitlistEntry, promoteWaitlist, expireOffer };
