const { Router } = require('express');
const controller = require('./coupon.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { isAdmin } = require('../../middleware/role.middleware');
const { createCouponSchema, validateCouponSchema } = require('./coupon.validation');

const router = Router();

router.get('/', authMiddleware, isAdmin, controller.getAll);
router.get('/:id', authMiddleware, isAdmin, controller.getById);
router.post('/', authMiddleware, isAdmin, validate({ body: createCouponSchema }), controller.create);
router.put('/:id', authMiddleware, isAdmin, controller.update);
router.delete('/:id', authMiddleware, isAdmin, controller.remove);
router.post('/validate', authMiddleware, validate({ body: validateCouponSchema }), controller.validate);

module.exports = router;
