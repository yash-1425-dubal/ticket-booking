const { Router } = require('express');
const controller = require('./review.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware, optionalAuth } = require('../../middleware/auth.middleware');
const { createReviewSchema, updateReviewSchema } = require('./review.validation');

const router = Router();

router.get('/movie/:movieId', optionalAuth, controller.getMovieReviews);
router.post('/movie/:movieId', authMiddleware, validate({ body: createReviewSchema }), controller.create);
router.put('/:id', authMiddleware, validate({ body: updateReviewSchema }), controller.update);
router.delete('/:id', authMiddleware, controller.remove);

module.exports = router;
