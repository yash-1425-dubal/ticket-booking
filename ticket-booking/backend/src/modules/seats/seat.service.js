const prisma = require('../../config/prisma');
const redis = require('../../config/redis');
const ApiError = require('../../utils/ApiError');
const { acquireLock, releaseLock } = require('../../utils/redisLock');
const env = require('../../config/env');

const HOLD_TTL = env.SEAT_HOLD_TTL_MINUTES ? env.SEAT_HOLD_TTL_MINUTES * 60 * 1000 : 10 * 60 * 1000;

function normalizeSeat(seat) {
  return {
    ...seat,
    price: Number(seat.price),
    category: String(seat.category),
    status: String(seat.status),
    row: Number(seat.row),
    col: Number(seat.col),
  };
}

async function getSeatMap(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      movie: { include: { venue: true } },
    },
  });
  if (!event) throw ApiError.notFound('Event not found');

  const seats = await prisma.seat.findMany({
    where: { eventId },
    orderBy: [{ row: 'asc' }, { col: 'asc' }],
  });

  // Group seats by row for the seat map
  const rows = {};
  for (const seat of seats) {
    const normalized = normalizeSeat(seat);
    if (!rows[normalized.row]) rows[normalized.row] = [];
    rows[normalized.row].push(normalized);
  }

  return {
    event,
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'AVAILABLE').length,
    heldSeats: seats.filter((s) => s.status === 'HELD').length,
    bookedSeats: seats.filter((s) => s.status === 'BOOKED').length,
    rows: Object.values(rows),
  };
}

async function holdSeats(eventId, seatIds, userId) {
  if (!seatIds || seatIds.length === 0) {
    throw ApiError.badRequest('No seats specified');
  }

  if (seatIds.length > 10) {
    throw ApiError.badRequest('Cannot hold more than 10 seats at once');
  }

  // Acquire a global lock on this batch operation
  const lockKey = `hold:${eventId}:${userId}`;
  const lockToken = await acquireLock(lockKey, 30000);
  if (!lockToken) {
    throw ApiError.tooMany('Please wait, another hold operation is in progress');
  }

  try {
    const heldSeats = [];
    const now = new Date();

    for (const seatId of seatIds) {
      // Acquire per-seat lock
      const seatLockKey = `seat:lock:${eventId}:${seatId}`;
      const seatLockToken = await acquireLock(seatLockKey, 10000);
      if (!seatLockToken) {
        // Release any previously held seats - revert DB + Redis + locks
        for (const hs of heldSeats) {
          await releaseLock(`seat:lock:${eventId}:${hs.id}`, hs.lockToken);
          if (redis.isAvailable) {
            await redis.del(`seat:hold:${hs.id}`);
          }
          await prisma.seat.update({
            where: { id: hs.id },
            data: { status: 'AVAILABLE', heldBy: null, heldAt: null, version: { increment: 1 } },
          });
        }
        throw ApiError.conflict(`Seat ${seatId} is temporarily locked`);
      }

      const seat = await prisma.seat.findUnique({ where: { id: seatId } });
      if (!seat || seat.eventId !== eventId) {
        await releaseLock(seatLockKey, seatLockToken);
        throw ApiError.notFound(`Seat ${seatId} not found in this event`);
      }

      if (seat.status !== 'AVAILABLE') {
        await releaseLock(seatLockKey, seatLockToken);
        throw ApiError.conflict(`Seat ${seat.seatNumber} is already ${seat.status.toLowerCase()}`);
      }

      // Update seat to HELD
      await prisma.seat.update({
        where: { id: seatId },
        data: {
          status: 'HELD',
          heldBy: userId,
          heldAt: now,
          version: { increment: 1 },
        },
      });

      // Set Redis hold key with TTL (NX - only if not already set)
      if (redis.isAvailable) {
        await redis.set(`seat:hold:${seatId}`, userId, 'NX', 'PX', HOLD_TTL);
      }

      heldSeats.push({ ...seat, lockKey: seatLockKey, lockToken: seatLockToken });
    }

    // Release per-seat locks
    for (const hs of heldSeats) {
      await releaseLock(hs.lockKey, hs.lockToken);
    }

    // Broadcast seat held event
    const expiresAt = new Date(Date.now() + HOLD_TTL);
    try {
      const { getSocketServer } = require('../../sockets');
      const io = getSocketServer();
      if (io) {
        io.to(`event:${eventId}`).emit('seatHeld', {
          eventId,
          seatIds: heldSeats.map((s) => s.id),
          userId,
          expiresAt,
        });
      }
    } catch {}

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SEATS_HELD',
          entityType: 'Seat',
          entityId: heldSeats.map((s) => s.id).join(','),
          metadata: { eventId, seatNumbers: heldSeats.map((s) => s.seatNumber), count: heldSeats.length },
        },
      });
    } catch {}

    return {
      heldSeats: heldSeats.map((s) => ({ id: s.id, seatNumber: s.seatNumber, row: s.row, col: s.col, category: s.category, price: s.price })),
      expiresAt,
      ttlMs: HOLD_TTL,
    };
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

async function releaseSeats(eventId, seatIds, userId) {
  if (!seatIds || seatIds.length === 0) {
    throw ApiError.badRequest('No seats specified');
  }

  const releasedSeats = [];

  for (const seatId of seatIds) {
    const seat = await prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) throw ApiError.notFound(`Seat ${seatId} not found`);

    if (seat.heldBy !== userId) {
      throw ApiError.forbidden('You did not hold this seat');
    }

    if (seat.status !== 'HELD') {
      throw ApiError.badRequest(`Seat ${seat.seatNumber} is not held`);
    }

    await prisma.seat.update({
      where: { id: seatId },
      data: { status: 'AVAILABLE', heldBy: null, heldAt: null, version: { increment: 1 } },
    });

    if (redis.isAvailable) {
      await redis.del(`seat:hold:${seatId}`);
    }
    releasedSeats.push(seat);
  }

  try {
    const { getSocketServer } = require('../../sockets');
    const io = getSocketServer();
    if (io) {
      io.to(`event:${eventId}`).emit('seatReleased', {
        eventId,
        seatIds: releasedSeats.map((s) => s.id),
      });
    }
  } catch {}

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SEATS_RELEASED',
        entityType: 'Seat',
        entityId: releasedSeats.map((s) => s.id).join(','),
        metadata: { eventId, seatNumbers: releasedSeats.map((s) => s.seatNumber), count: releasedSeats.length },
      },
    });
  } catch {}

  return { releasedSeats: releasedSeats.map((s) => ({ id: s.id, seatNumber: s.seatNumber })) };
}

async function releaseExpiredHolds() {
  const expiryTime = new Date(Date.now() - HOLD_TTL);

  // Fetch the expired seat IDs BEFORE updating them
  const expiredSeats = await prisma.seat.findMany({
    where: {
      status: 'HELD',
      heldAt: { lt: expiryTime },
    },
    select: { id: true, eventId: true },
  });

  if (expiredSeats.length === 0) return 0;

  const expiredIds = expiredSeats.map((s) => s.id);

  // Bulk-update expired seats
  await prisma.seat.updateMany({
    where: { id: { in: expiredIds } },
    data: {
      status: 'AVAILABLE',
      heldBy: null,
      heldAt: null,
      version: { increment: 1 },
    },
  });

  // Clear Redis keys and broadcast for each expired seat
  for (const seat of expiredSeats) {
    if (redis.isAvailable) {
      await redis.del(`seat:hold:${seat.id}`);
    }
    try {
      const { getSocketServer } = require('../../sockets');
      const io = getSocketServer();
      if (io) {
        io.to(`event:${seat.eventId}`).emit('seatReleased', {
          eventId: seat.eventId,
          seatIds: [seat.id],
        });
      }
    } catch {}
  }

  return expiredSeats.length;
}

module.exports = { getSeatMap, holdSeats, releaseSeats, releaseExpiredHolds };
