const { Router } = require('express');
const controller = require('./qr.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const router = Router();

router.get('/:bookingId/qr', authMiddleware, controller.getQr);
router.get('/:bookingId/verify', controller.verify);

module.exports = router;
