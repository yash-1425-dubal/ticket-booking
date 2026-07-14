const { Router } = require('express');
const controller = require('./event.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { isOrganizerOrAdmin } = require('../../middleware/role.middleware');
const { createEventSchema, updateEventSchema } = require('./event.validation');

const router = Router();

router.post('/', authMiddleware, isOrganizerOrAdmin, validate({ body: createEventSchema }), controller.create);
router.get('/:id', authMiddleware, controller.getById);
router.patch('/:id', authMiddleware, isOrganizerOrAdmin, validate({ body: updateEventSchema }), controller.update);
router.delete('/:id', authMiddleware, isOrganizerOrAdmin, controller.remove);

module.exports = router;
