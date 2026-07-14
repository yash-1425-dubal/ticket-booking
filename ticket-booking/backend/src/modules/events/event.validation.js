const { z } = require('zod');

const createEventSchema = z.object({
  movieId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  status: z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional().default('SCHEDULED'),
  seatPricing: z.object({
    PREMIUM: z.number().positive().max(99999).optional(),
    STANDARD: z.number().positive().max(99999).optional(),
    ECONOMY: z.number().positive().max(99999).optional(),
  }).optional(),
});

const updateEventSchema = createEventSchema.partial();

module.exports = { createEventSchema, updateEventSchema };
