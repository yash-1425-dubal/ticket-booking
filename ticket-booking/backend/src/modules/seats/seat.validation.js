const { z } = require('zod');

const holdSeatSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1).max(10),
});

const releaseSeatSchema = z.object({
  seatIds: z.array(z.string().uuid()).min(1).max(10),
});

module.exports = { holdSeatSchema, releaseSeatSchema };
