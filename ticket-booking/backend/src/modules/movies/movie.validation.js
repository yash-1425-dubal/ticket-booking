const { z } = require('zod');

const createMovieSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(10).max(2000).optional(),
  venueId: z.string().uuid(),
  language: z.string().optional(),
  posterUrl: z.string().url().optional().or(z.literal('')),
  category: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
});

const updateMovieSchema = createMovieSchema.partial();

module.exports = { createMovieSchema, updateMovieSchema };
