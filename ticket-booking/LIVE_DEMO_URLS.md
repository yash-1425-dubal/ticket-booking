# Live Demo URLs

## Frontend (Vercel)
**https://ticket-booking-wheat-mu.vercel.app**

## Backend (Railway)
Deploy on Railway with service root at `ticket-booking/backend`

---

## Quick Start URLs

| Feature | URL |
|---------|-----|
| Home / Landing | https://ticket-booking-wheat-mu.vercel.app |
| Browse Movies | https://ticket-booking-wheat-mu.vercel.app/movies |
| Login | https://ticket-booking-wheat-mu.vercel.app/login |
| Register | https://ticket-booking-wheat-mu.vercel.app/register |
| My Bookings | https://ticket-booking-wheat-mu.vercel.app/bookings |
| My Waitlists | https://ticket-booking-wheat-mu.vercel.app/waitlist |
| Notifications | https://ticket-booking-wheat-mu.vercel.app/notifications |
| Profile | https://ticket-booking-wheat-mu.vercel.app/profile |

### Admin
| Feature | URL |
|---------|-----|
| Admin Dashboard | https://ticket-booking-wheat-mu.vercel.app/admin/dashboard |
| Admin Users | https://ticket-booking-wheat-mu.vercel.app/admin/users |
| Admin Venues | https://ticket-booking-wheat-mu.vercel.app/admin/venues |
| Queue Dashboard (Bull Board) | `https://your-railway-url/admin/queues` |

### Organizer
| Feature | URL |
|---------|-----|
| Organizer Dashboard | https://ticket-booking-wheat-mu.vercel.app/organizer/dashboard |
| Organizer Events | https://ticket-booking-wheat-mu.vercel.app/organizer/events |
| Organizer Movies | https://ticket-booking-wheat-mu.vercel.app/organizer/movies |

---

## API Endpoints (Backend)

Base URL: `https://your-railway-url/api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Register new user |
| `/auth/login` | POST | Login |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/me` | GET | Get current user |
| `/movies` | GET | List movies with filters |
| `/movies/:id` | GET | Get movie details with events |
| `/events/:id` | GET | Get event details |
| `/events/:id/seats` | GET | Get seat map for event |
| `/seats/hold` | POST | Hold seats |
| `/seats/release` | POST | Release held seats |
| `/bookings` | POST | Create booking (returns QR) |
| `/bookings` | GET | List user bookings |
| `/bookings/:id` | GET | Get booking details |
| `/bookings/:id/cancel` | POST | Cancel booking |
| `/waitlist/join` | POST | Join waitlist |
| `/waitlist/leave` | POST | Leave waitlist |
| `/waitlist/my` | GET | Get user waitlists |
| `/qr/verify/:token` | GET | Verify QR ticket |
| `/search` | GET | Search movies/events |
| `/coupons/validate` | POST | Validate coupon |
| `/reviews` | POST | Add review |
| `/reviews/movie/:id` | GET | Get movie reviews |

---

## WebSocket Events

Connect to: `https://your-railway-url`

Rooms:
- `event:<eventId>` - Seat status changes
- `user:<userId>` - Personal notifications

Events:
- `seatHeld` - Seat held by user
- `seatReleased` - Seat released/available
- `seatBooked` - Seat booked
- `bookingCancelled` - Booking cancelled
- `waitlistPromoted` - Waitlist offer
- `notification` - Personal notification