const { Router } = require('express');
const controller = require('./admin.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { isAdmin } = require('../../middleware/role.middleware');

const router = Router();

router.get('/users', authMiddleware, isAdmin, controller.getUsers);
router.patch('/users/:id/role', authMiddleware, isAdmin, controller.updateRole);
router.delete('/users/:id', authMiddleware, isAdmin, controller.removeUser);
router.get('/bookings', authMiddleware, isAdmin, controller.getBookings);
router.get('/audit-logs', authMiddleware, isAdmin, controller.getAuditLogs);
router.get('/config', authMiddleware, isAdmin, controller.getConfig);
router.put('/config', authMiddleware, isAdmin, controller.updateConfig);
router.post('/test-email', authMiddleware, isAdmin, controller.testEmail);

module.exports = router;
