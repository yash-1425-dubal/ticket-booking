const { Router } = require('express');
const controller = require('./auth.controller');
const validate = require('../../middleware/validateRequest.middleware');
const { authMiddleware } = require('../../middleware/auth.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} = require('./auth.validation');

const router = Router();

router.post('/register', validate({ body: registerSchema }), controller.register);
router.post('/login', validate({ body: loginSchema }), controller.login);
router.post('/refresh', validate({ body: refreshSchema }), controller.refresh);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password/:token', validate({ body: resetPasswordSchema }), controller.resetPassword);
router.get('/me', authMiddleware, controller.getMe);
router.patch('/me', authMiddleware, validate({ body: updateProfileSchema }), controller.updateProfile);
router.post('/verify-email/:token', controller.verifyEmail);
router.post('/resend-verification', authMiddleware, controller.resendVerification);

module.exports = router;
