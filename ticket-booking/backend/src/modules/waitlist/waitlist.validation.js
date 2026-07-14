const { z } = require('zod');

const joinWaitlistSchema = z.object({
  eventId: z.string().uuid(),
  category: z.enum(['PREMIUM', 'STANDARD', 'ECONOMY']),
});

module.exports = { joinWaitlistSchema };
