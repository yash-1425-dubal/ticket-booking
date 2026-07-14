const { Router } = require('express');
const controller = require('./notification.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

const router = Router();

router.get('/', authMiddleware, controller.getAll);
router.get('/unread-count', authMiddleware, controller.unreadCount);
router.patch('/read-all', authMiddleware, controller.markAllRead);
router.patch('/:id/read', authMiddleware, controller.markRead);

module.exports = router;
