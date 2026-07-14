const { Router } = require('express');
const controller = require('./movie.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware, optionalAuth } = require('../../middleware/auth.middleware');
const { isOrganizerOrAdmin } = require('../../middleware/role.middleware');
const { createMovieSchema, updateMovieSchema } = require('./movie.validation');

const router = Router();

router.get('/', optionalAuth, controller.getAll);
router.get('/mine', authMiddleware, isOrganizerOrAdmin, controller.getMyMovies);
router.get('/:id', optionalAuth, controller.getById);
router.post('/', authMiddleware, isOrganizerOrAdmin, validate({ body: createMovieSchema }), controller.create);
router.patch('/:id', authMiddleware, isOrganizerOrAdmin, validate({ body: updateMovieSchema }), controller.update);
router.delete('/:id', authMiddleware, isOrganizerOrAdmin, controller.remove);

module.exports = router;
