const ApiError = require('../utils/ApiError');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    next();
  };
}

const isAdmin = requireRole('ADMIN');
const isOrganizer = requireRole('ORGANIZER');
const isOrganizerOrAdmin = requireRole('ORGANIZER', 'ADMIN');
const isCustomer = requireRole('CUSTOMER');

module.exports = { requireRole, isAdmin, isOrganizer, isOrganizerOrAdmin, isCustomer };
