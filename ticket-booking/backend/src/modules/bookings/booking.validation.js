const { z } = require('zod');

const createBookingSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1).max(10),
  couponCode: z.string().optional(),
});

const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

module.exports = { createBookingSchema, cancelBookingSchema };
