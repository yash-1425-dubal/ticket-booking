const { Router } = require('express');
const controller = require('./booking.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const idempotencyMiddleware = require('../../middleware/idempotency.middleware');
const { createBookingSchema, cancelBookingSchema } = require('./booking.validation');

const router = Router();

router.get('/', authMiddleware, controller.getAll);
router.get('/:id', authMiddleware, controller.getById);
router.post('/:eventId', authMiddleware, idempotencyMiddleware, validate({ body: createBookingSchema }), controller.create);
router.post('/:id/cancel', authMiddleware, validate({ body: cancelBookingSchema }), controller.cancel);

module.exports = router;
