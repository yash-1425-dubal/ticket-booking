const { Router } = require('express');
const controller = require('./seat.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware, optionalAuth } = require('../../middleware/auth.middleware');
const { holdSeatSchema, releaseSeatSchema } = require('./seat.validation');

const router = Router({ mergeParams: true });

router.get('/', optionalAuth, controller.getMap);
router.post('/hold', authMiddleware, validate({ body: holdSeatSchema }), controller.hold);
router.post('/release', authMiddleware, validate({ body: releaseSeatSchema }), controller.release);

module.exports = router;
