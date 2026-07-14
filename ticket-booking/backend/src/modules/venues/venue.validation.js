const { z } = require('zod');

const createVenueSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(2).max(500),
  city: z.string().min(2).max(100),
  totalRows: z.number().int().min(1).max(100),
  seatsPerRow: z.number().int().min(1).max(50),
});

const updateVenueSchema = createVenueSchema.partial();

module.exports = { createVenueSchema, updateVenueSchema };
