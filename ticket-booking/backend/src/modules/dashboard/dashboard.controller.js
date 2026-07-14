const dashboardService = require('./dashboard.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const organizer = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOrganizerDashboard(req.user.id);
  sendSuccess(res, 200, data);
});

const admin = asyncHandler(async (req, res) => {
  const data = await dashboardService.getAdminDashboard();
  sendSuccess(res, 200, data);
});

module.exports = { organizer, admin };
