const { Router } = require('express');
const controller = require('./scraper.controller');
const { optionalAuth, authMiddleware } = require('../../middleware/auth.middleware');
const { isOrganizer } = require('../../middleware/role.middleware');

const router = Router();

router.get('/movies', optionalAuth, controller.getNowShowingMovies);
router.get('/events', optionalAuth, controller.getEventsList);
router.get('/movie-details', optionalAuth, controller.getMovieDetails);
router.post('/refresh-cache', authMiddleware, isOrganizer, controller.refreshCache);
router.post('/import-scraper-movie', authMiddleware, controller.importMovie);

module.exports = router;
