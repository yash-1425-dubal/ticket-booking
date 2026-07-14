const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, 201, result, 'Registration successful');
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, { ip: req.ip, userAgent: req.headers?.['user-agent'] });
  sendSuccess(res, 200, result, 'Login successful');
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body);
  sendSuccess(res, 200, result, 'Token refreshed');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  sendSuccess(res, 200, result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword({ ...req.body, token: req.params.token });
  sendSuccess(res, 200, result);
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  sendSuccess(res, 200, { user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user.id, req.body);
  sendSuccess(res, 200, result, 'Profile updated');
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.params.token);
  sendSuccess(res, 200, result, 'Email verified successfully');
});

const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification(req.user.id);
  sendSuccess(res, 200, result);
});

module.exports = { register, login, refresh, forgotPassword, resetPassword, getMe, updateProfile, verifyEmail, resendVerification };
