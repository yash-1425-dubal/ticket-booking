const adminService = require('./admin.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const getUsers = asyncHandler(async (req, res) => {
  const users = await adminService.getAllUsers(req.query);
  sendSuccess(res, 200, users);
});

const updateRole = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserRole(req.params.id, req.body.role);
  sendSuccess(res, 200, user, 'User role updated');
});

const removeUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.params.id);
  sendSuccess(res, 200, null, 'User deleted');
});

const getBookings = asyncHandler(async (req, res) => {
  const bookings = await adminService.getAllBookings(req.query);
  sendSuccess(res, 200, bookings);
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await adminService.getAuditLogs(req.query);
  sendSuccess(res, 200, result);
});

const getConfig = asyncHandler(async (req, res) => {
  const { key } = req.query;
  const config = await adminService.getConfig(key);
  sendSuccess(res, 200, config);
});

const updateConfig = asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) return sendSuccess(res, 400, null, 'Key is required');
  const result = await adminService.updateConfig(key, value);
  sendSuccess(res, 200, result, 'Config updated');
});

module.exports = { getUsers, updateRole, removeUser, getBookings, getAuditLogs, getConfig, updateConfig };
