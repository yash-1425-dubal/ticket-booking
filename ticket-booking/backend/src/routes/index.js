const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const rateLimiter = require('../middleware/rateLimiter');

const authRoutes = require('../modules/auth/auth.routes');
const venueRoutes = require('../modules/venues/venue.routes');
const movieRoutes = require('../modules/movies/movie.routes');
const eventRoutes = require('../modules/events/event.routes');
const seatRoutes = require('../modules/seats/seat.routes');
const bookingRoutes = require('../modules/bookings/booking.routes');
const qrRoutes = require('../modules/qr/qr.routes');
const waitlistRoutes = require('../modules/waitlist/waitlist.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const notificationRoutes = require('../modules/notifications/notification.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const searchRoutes = require('../modules/search/search.routes');
const scraperRoutes = require('../modules/scraper/scraper.routes');
const couponRoutes = require('../modules/coupons/coupon.routes');
const reviewRoutes = require('../modules/reviews/review.routes');
const organizerRoutes = require('../modules/organizer/organizer.routes');

const router = Router();

const authLimiter = rateLimiter(60_000, 20);
const apiLimiter = rateLimiter(60_000, 100);

router.use('/api/auth', authLimiter, authRoutes);
router.use('/api/venues', apiLimiter, venueRoutes);
router.use('/api/movies', apiLimiter, movieRoutes);
router.use('/api/events', apiLimiter, eventRoutes);
router.use('/api/events/:eventId/seats', apiLimiter, seatRoutes);
router.use('/api/bookings', apiLimiter, bookingRoutes);
router.use('/api/qr', apiLimiter, qrRoutes);
router.use('/api/waitlist', apiLimiter, waitlistRoutes);
router.use('/api/dashboard', apiLimiter, dashboardRoutes);
router.use('/api/notifications', apiLimiter, notificationRoutes);
router.use('/api/admin', apiLimiter, adminRoutes);
router.use('/api/search', apiLimiter, searchRoutes);
router.use('/api/organizer', apiLimiter, organizerRoutes);
router.use('/api/scraper', apiLimiter, scraperRoutes);
router.use('/api/coupons', apiLimiter, couponRoutes);
router.use('/api/reviews', apiLimiter, reviewRoutes);

router.get('/api/health', (req, res) => {
  sendSuccess(res, 200, { uptime: process.uptime() }, 'Ticket Booking API running');
});

module.exports = router;
