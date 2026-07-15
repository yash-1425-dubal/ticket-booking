const { Router } = require('express');
const controller = require('./organizer.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { isOrganizer } = require('../../middleware/role.middleware');

const router = Router();

// All routes require authentication and organizer role
router.use(authMiddleware, isOrganizer);

router.get('/events', controller.getMyEvents);
router.get('/events/:id', controller.getEventDetails);
router.get('/movies', controller.getMyMovies);
router.get('/revenue', controller.getRevenueSummary);

module.exports = router;