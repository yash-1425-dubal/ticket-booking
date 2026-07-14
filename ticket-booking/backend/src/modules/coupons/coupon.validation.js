const { z } = require('zod');

const createCouponSchema = z.object({
  code: z.string().min(3).max(20).transform(s => s.toUpperCase()),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  minBookingAmount: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

const validateCouponSchema = z.object({
  code: z.string(),
  bookingAmount: z.number().positive(),
});

module.exports = { createCouponSchema, validateCouponSchema };
