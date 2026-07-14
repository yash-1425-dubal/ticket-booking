const { Router } = require('express');
const controller = require('./venue.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware, optionalAuth } = require('../../middleware/auth.middleware');
const { isAdmin } = require('../../middleware/role.middleware');
const { createVenueSchema, updateVenueSchema } = require('./venue.validation');

const router = Router();

router.get('/', optionalAuth, controller.getAll);
router.get('/cities', optionalAuth, controller.getCities);
router.get('/:id', optionalAuth, controller.getById);
router.post('/', authMiddleware, isAdmin, validate({ body: createVenueSchema }), controller.create);
router.patch('/:id', authMiddleware, isAdmin, validate({ body: updateVenueSchema }), controller.update);
router.delete('/:id', authMiddleware, isAdmin, controller.remove);

module.exports = router;
