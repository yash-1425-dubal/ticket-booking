const { Router } = require('express');
const controller = require('./dashboard.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { isOrganizer, isAdmin } = require('../../middleware/role.middleware');

const router = Router();

router.get('/organizer', authMiddleware, isOrganizer, controller.organizer);
router.get('/admin', authMiddleware, isAdmin, controller.admin);

module.exports = router;
