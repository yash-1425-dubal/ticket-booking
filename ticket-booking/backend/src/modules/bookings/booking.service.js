const prisma = require('../../config/prisma');
const redis = require('../../config/redis');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { acquireLock, releaseLock } = require('../../utils/redisLock');
const { v4: uuidv4 } = require('uuid');
const { generateQrImage } = require('../qr/qr.service');

async function createBooking(eventId, seatIds, userId, idempotencyKey) {
  if (!seatIds || seatIds.length === 0) {
    throw ApiError.badRequest('No seats specified');
  }

  // Acquire distributed lock to prevent concurrent booking on same seats
  const lockKey = `booking:${eventId}:${userId}`;
  const lockToken = await acquireLock(lockKey, 30000);
  if (!lockToken) {
    throw ApiError.tooMany('Please wait, another booking is in progress');
  }

  let booking;
  try {
    // Use a Prisma transaction for atomicity
    booking = await prisma.$transaction(async (tx) => {
      // Verify all seats are held by this user and still valid
      const seats = await tx.seat.findMany({
        where: {
          id: { in: seatIds },
          eventId,
        },
      });

      if (seats.length !== seatIds.length) {
        throw ApiError.badRequest('Some seats were not found');
      }

      // Check hold validity
      for (const seat of seats) {
        if (seat.status !== 'HELD') {
          throw ApiError.conflict(`Seat ${seat.seatNumber} is no longer held (status: ${seat.status})`);
        }
        if (seat.heldBy !== userId) {
          throw ApiError.forbidden(`Seat ${seat.seatNumber} was not held by you`);
        }
      }

      // Calculate total
      const totalAmount = seats.reduce((sum, s) => sum + Number(s.price), 0);

      // Update seats to BOOKED — only if still HELD to prevent double-booking
      for (const seat of seats) {
        const result = await tx.seat.updateMany({
          where: { id: seat.id, status: 'HELD' },
          data: {
            status: 'BOOKED',
            heldBy: null,
            heldAt: null,
            version: { increment: 1 },
          },
        });
        if (result.count === 0) {
          throw ApiError.conflict(`Seat ${seat.seatNumber} was already booked by another user`);
        }
      }

      // Create booking with seats
      const newBooking = await tx.booking.create({
        data: {
          userId,
          eventId,
          status: 'CONFIRMED',
          totalAmount,
          idempotencyKey,
          bookingSeats: {
            create: seats.map((s) => ({
              seatId: s.id,
              price: s.price,
            })),
          },
          payment: {
            create: {
              amount: totalAmount,
              method: 'CARD',
              status: 'PAID',
            },
          },
        },
        include: {
          bookingSeats: {
            include: { seat: true },
          },
          event: {
            include: {
              movie: { include: { venue: true } },
            },
          },
          payment: true,
        },
      });

      return newBooking;
    });
  } finally {
    // Release lock IMMEDIATELY after transaction — before side effects
    await releaseLock(lockKey, lockToken);
  }

  // Generate QR code for immediate frontend response (non-blocking for user)
  let qrData = null;
  try {
    qrData = await generateQrImage(booking.id);
  } catch (qrErr) {
    console.error('QR generation failed:', qrErr?.message);
  }

  // Clear Redis hold keys (non-blocking)
  if (redis.isAvailable) {
    for (const seatId of seatIds) {
      redis.del(`seat:hold:${seatId}`).catch(() => {});
    }
  }

  // Run all side effects in background — don't block response
  setImmediate(async () => {
    try {
      // Broadcast seat booked
      const { getSocketServer } = require('../../sockets');
      const io = getSocketServer();
      if (io) {
        io.to(`event:${eventId}`).emit('seatBooked', { eventId, seatIds, userId });
      }
    } catch {}

    try {
      // Create notification for the user
      const seatList = booking.bookingSeats.map((bs) => bs.seat.seatNumber).join(', ');
      await prisma.notification.create({
        data: {
          userId,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: `Your booking for ${booking.event?.movie?.title || 'Event'} (${seatList}) is confirmed. Total: ₹${Number(booking.totalAmount).toLocaleString('en-IN')}`,
        },
      });
      const { getSocketServer } = require('../../sockets');
      const io = getSocketServer();
      if (io) {
        io.to(`user:${userId}`).emit('notification', {
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: `Your booking is confirmed. Total: ₹${Number(booking.totalAmount).toLocaleString('en-IN')}`,
        });
      }
    } catch {}

    // Send booking confirmation email (via queue if Redis available, fallback to direct send)
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      const seatList = booking.bookingSeats.map((bs) => bs.seat.seatNumber).join(', ');
      const eventTitle = booking.event?.movie?.title || 'Event';
      const venueName = booking.event?.movie?.venue?.name || '';

      // Generate QR image buffer for email embedding
      let qrAttachments = [];
      let qrImgHtml = '';
      try {
        const QRCode = require('qrcode');
        const verifyUrl = `${env.FRONTEND_URL}/ticket/${booking.id}`;
        const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 300, margin: 2 });
        qrAttachments.push({ filename: 'qrcode.png', content: qrBuffer, cid: 'qrcode' });
        qrImgHtml = `<div style="text-align:center;margin:20px 0"><img src="cid:qrcode" alt="QR Ticket" style="width:200px;height:200px" /><p style="color:#666;font-size:12px;margin-top:4px">Show this QR at the venue for entry</p></div>`;
      } catch (qrErr) {
        console.error('Failed to generate QR for email:', qrErr?.message);
      }

      const emailHtml = `<h2>Booking Confirmed!</h2><p>Hi ${user?.name || 'there'},</p><p>Your booking for <strong>${eventTitle}</strong>${venueName ? ` at ${venueName}` : ''} is confirmed.</p><p><strong>Seats:</strong> ${seatList}</p><p><strong>Total:</strong> ₹${Number(booking.totalAmount).toLocaleString('en-IN')}</p>${qrImgHtml}<p>Thank you for your booking!</p>`;

      const mailOptions = {
        from: env.EMAIL_FROM,
        to: user?.email,
        subject: `Booking Confirmed - ${eventTitle}`,
        html: emailHtml,
        attachments: qrAttachments,
      };

      const { getQueue } = require('../../queues/queues');
      const emailQueue = getQueue('email');
      if (emailQueue) {
        // Queue path (Redis available) — encode buffer as base64 for serialization
        const serializedAttachments = qrAttachments.map((a) => ({
          ...a,
          content: a.content ? a.content.toString('base64') : undefined,
          encoding: 'base64',
        }));
        await emailQueue.add('booking-confirmation', {
          bookingId: booking.id,
          userId,
          email: user?.email,
          subject: `Booking Confirmed - ${eventTitle}`,
          html: emailHtml,
          attachments: serializedAttachments,
        });
      } else {
        // Direct send fallback (no Redis)
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: false,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
        await transporter.sendMail(mailOptions);
      }

      // Log email
      await prisma.emailLog.create({
        data: { userId, to: user?.email, subject: `Booking Confirmed - ${eventTitle}`, status: 'SENT', bookingId: booking.id },
      });
    } catch (e) {
      console.error('Failed to send booking email:', e?.message);
    }

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'BOOKING_CREATED',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { eventId, seatCount: seatIds.length, totalAmount: Number(booking.totalAmount) },
        },
      });
    } catch {}
  });

  // Return booking with QR data so frontend doesn't need second API call
  return {
    ...booking,
    qrImage: qrData?.qrImage,
    qrToken: qrData?.qrToken,
  };
}

async function getUserBookings(userId) {
  return prisma.booking.findMany({
    where: { userId },
    include: {
      bookingSeats: {
        include: { seat: { select: { seatNumber: true, row: true, col: true, category: true } } },
      },
      event: {
        include: {
          movie: { select: { id: true, title: true } },
        },
      },
      payment: { select: { amount: true, status: true, paidAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getBookingById(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingSeats: {
        include: { seat: { select: { seatNumber: true, row: true, col: true, category: true } } },
      },
      event: {
        include: {
          movie: { include: { venue: true } },
        },
      },
      payment: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.userId !== userId) throw ApiError.forbidden('Not your booking');

  return booking;
}

async function cancelBooking(bookingId, userId, reason) {
  // Acquire lock to prevent concurrent cancellation
  const lockKey = `booking-cancel:${bookingId}:${userId}`;
  const lockToken = await acquireLock(lockKey, 15000);
  if (!lockToken) {
    throw ApiError.tooMany('Cancellation in progress, please wait');
  }

  let booking;
  try {
    booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSeats: {
          include: { seat: { select: { seatNumber: true, category: true } } },
        },
        event: {
          include: {
            movie: { select: { id: true, title: true, venue: { select: { name: true } } } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.userId !== userId) throw ApiError.forbidden('Not your booking');

    if (booking.status !== 'CONFIRMED') {
      throw ApiError.badRequest('Booking cannot be cancelled');
    }

    const cancelledBooking = await prisma.$transaction(async (tx) => {
      // Update booking status
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      // Release seats back to available
      for (const bs of booking.bookingSeats) {
        await tx.seat.update({
          where: { id: bs.seatId },
          data: { status: 'AVAILABLE', version: { increment: 1 } },
        });
      }

      return updated;
    });
  } finally {
    // Release lock immediately after transaction
    await releaseLock(lockKey, lockToken);
  }

  // Return immediately — run side effects in background
  setImmediate(async () => {
    try {
      // Broadcast cancellation
      const { getSocketServer } = require('../../sockets');
      const io = getSocketServer();
      if (io) {
        io.to(`event:${booking.eventId}`).emit('bookingCancelled', {
          eventId: booking.eventId,
          seatIds: booking.bookingSeats.map((bs) => bs.seatId),
        });
      }
    } catch {}

    // Trigger waitlist promotion for each freed seat
    try {
      const { promoteWaitlist } = require('../waitlist/waitlist.service');
      for (const bs of booking.bookingSeats) {
        await promoteWaitlist(booking.eventId, bs.seatId);
      }
    } catch {}

    // Create cancellation notification for the user
    try {
      const seatList = booking.bookingSeats.map((bs) => bs.seat.seatNumber).join(', ');
      const eventTitle = booking.event?.movie?.title || 'Event';
      await prisma.notification.create({
        data: {
          userId,
          type: 'BOOKING_CANCELLED',
          title: 'Booking Cancelled',
          message: `Your booking for ${eventTitle} (${seatList}) has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
        },
      });
      const { getSocketServer } = require('../../sockets');
      const io = getSocketServer();
      if (io) {
        io.to(`user:${userId}`).emit('notification', {
          type: 'BOOKING_CANCELLED',
          title: 'Booking Cancelled',
          message: `Your booking for ${eventTitle} has been cancelled.`,
        });
      }
    } catch {}

    // Send cancellation email (non-blocking)
    try {
      const seatList = booking.bookingSeats.map((bs) => bs.seat.seatNumber).join(', ');
      const eventTitle = booking.event?.movie?.title || 'Event';
      const venueName = booking.event?.movie?.venue?.name || '';
      const totalRefund = Number(booking.totalAmount).toFixed(2);
      const userName = booking.user?.name || 'there';

      const emailHtml = `
<h2>Booking Cancelled</h2>
<p>Hi ${userName},</p>
<p>Your booking for <strong>${eventTitle}</strong>${venueName ? ` at ${venueName}` : ''} has been cancelled.</p>
<p><strong>Seats:</strong> ${seatList}</p>
<p><strong>Total Refund:</strong> ₹${Number(totalRefund).toLocaleString('en-IN')}</p>
${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
<p>If you did not request this cancellation, please contact support immediately.</p>
<hr />
<p style="color:#666;font-size:12px">This is an automated message from TicketBook.</p>`;

      const mailOptions = {
        from: env.EMAIL_FROM,
        to: booking.user?.email,
        subject: `Booking Cancelled - ${eventTitle}`,
        html: emailHtml,
      };

      const { getQueue } = require('../../queues/queues');
      const emailQueue = getQueue('email');
      if (emailQueue) {
        await emailQueue.add('booking-cancellation', {
          bookingId,
          userId,
          email: booking.user?.email,
          subject: `Booking Cancelled - ${eventTitle}`,
          html: emailHtml,
        });
      } else {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: false,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
        await transporter.sendMail(mailOptions);
      }

      // Log cancellation email
      try {
        await prisma.emailLog.create({
          data: { userId, to: booking.user?.email, subject: `Booking Cancelled - ${eventTitle}`, status: 'SENT', bookingId },
        });
      } catch {}
    } catch (e) {
      console.error('Failed to send cancellation email:', e?.message);
    }

    // Audit log for cancellation
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'BOOKING_CANCELLED',
          entityType: 'Booking',
          entityId: bookingId,
          metadata: { reason, totalRefund: Number(booking.totalAmount) },
        },
      });
    } catch {}
  });

  return cancelledBooking;
}

module.exports = { createBooking, getUserBookings, getBookingById, cancelBooking };