const { Router } = require('express');
const controller = require('./waitlist.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { joinWaitlistSchema } = require('./waitlist.validation');

const router = Router();

router.post('/join', authMiddleware, validate({ body: joinWaitlistSchema }), controller.join);
router.get('/my', authMiddleware, controller.getMyEntries);
router.get('/event/:eventId', authMiddleware, controller.status);
router.delete('/event/:eventId', authMiddleware, controller.leave);
router.delete('/:id', authMiddleware, controller.cancelEntry);

module.exports = router;
