const QRCode = require('qrcode');
const crypto = require('crypto');
const prisma = require('../../config/prisma');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

function generateQrToken(payload) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, v: hmac })).toString('base64');
}

function verifyQrToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const { v: hmac, ...payload } = decoded;
    const data = JSON.stringify(payload);
    const expectedHmac = crypto.createHmac('sha256', env.JWT_SECRET).update(data).digest('hex');
    if (hmac !== expectedHmac) return null;
    return payload;
  } catch {
    return null;
  }
}

async function generateQrImage(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingSeats: { include: { seat: true } },
      event: { include: { movie: { include: { venue: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!booking) throw ApiError.notFound('Booking not found');

  const payload = {
    bookingId: booking.id,
    userId: booking.userId,
    eventId: booking.eventId,
    movieTitle: booking.event.movie.title,
    seats: booking.bookingSeats.map((bs) => bs.seat.seatNumber),
    timestamp: Date.now(),
  };

  const token = generateQrToken(payload);
  const qrContent = `${env.FRONTEND_URL}/ticket/${booking.id}?token=${encodeURIComponent(token)}`;
  const qrImage = await QRCode.toDataURL(qrContent, { width: 300, margin: 2 });

  return {
    qrImage,
    qrToken: token,
    booking: {
      id: booking.id,
      status: booking.status,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt,
    },
    event: {
      title: booking.event.movie.title,
      venue: booking.event.movie.venue?.name,
    },
    seats: booking.bookingSeats.map((bs) => ({
      seatNumber: bs.seat.seatNumber,
      category: bs.seat.category,
    })),
  };
}

async function verifyTicket(bookingId, token) {
  const payload = verifyQrToken(token);
  if (!payload) throw ApiError.unauthorized('Invalid or tampered QR token');
  if (payload.bookingId !== bookingId) throw ApiError.unauthorized('Token does not match this booking');

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingSeats: { include: { seat: true } },
      event: { include: { movie: { include: { venue: true } } } },
      user: { select: { id: true, name: true } },
    },
  });

  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'CONFIRMED') {
    // Log invalid verification attempt
    try {
      await prisma.ticketVerification.create({
        data: { bookingId, status: 'INVALID', verifiedBy: payload.verifiedBy },
      });
    } catch {}
    throw ApiError.badRequest('Booking is not confirmed');
  }

  // Log successful verification
  try {
    await prisma.ticketVerification.create({
      data: { bookingId, status: 'USED', verifiedBy: payload.verifiedBy },
    });
  } catch {}

  return {
    valid: true,
    booking: {
      id: booking.id,
      status: booking.status,
      totalAmount: booking.totalAmount,
      createdAt: booking.createdAt,
    },
    event: {
      title: booking.event.movie.title,
      venue: booking.event.movie.venue?.name,
      startTime: booking.event.startTime,
    },
    user: {
      name: booking.user.name,
    },
    seats: booking.bookingSeats.map((bs) => ({
      seatNumber: bs.seat.seatNumber,
      category: bs.seat.category,
      price: Number(bs.price),
    })),
  };
}

module.exports = { generateQrImage, generateQrToken, verifyQrToken, verifyTicket };
