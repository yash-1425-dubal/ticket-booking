# Ticket Booking System

A full-stack ticket booking platform with real-time seat selection, waitlist management, QR ticket verification, and email notifications. Supports movies, concerts, theater shows, and events with role-based access for customers, organizers, and administrators.

## Live Demo

| Environment | URL |
|-------------|-----|
| **Frontend (Vercel)** | [https://ticket-booking-wheat-mu.vercel.app](https://ticket-booking-wheat-mu.vercel.app) |
| **Backend (Railway)** | Deploy on Railway with backend service root at `ticket-booking/backend` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS 3 |
| Backend | Node.js, Express 5 |
| Database ORM | Prisma 7 with PostgreSQL adapter |
| Database | PostgreSQL 16 |
| Cache / Distributed Locks | Redis 7 (ioredis) |
| Background Jobs | BullMQ (email, waitlist expiry, seat cleanup) |
| Real-time | Socket.IO (seat updates, notifications) |
| Authentication | JWT (access + refresh token rotation) |
| Validation | Zod 4 |
| Testing | Jest + Supertest |

## Features

### Role-Based Access
- **Customer**: Browse events, select seats, book tickets, manage bookings, join waitlists, leave reviews.
- **Organizer**: Create/manage movies and events, view dashboards with revenue/occupancy analytics, import events from BookMyShow scraper.
- **Admin**: Manage users, venues, coupons; view system-wide audit logs and booking data.

### Interactive Seat Map
- Visual grid layout with PREMIUM (rows 1-3), STANDARD (rows 4-6), and ECONOMY (rows 7+) categories.
- Real-time availability with color-coded seat states: available, held (by other), selected, booked.
- Max 10 seats per hold. Frontend countdown timer from hold expiry.

### Seat Holding with TTL
- Seats are held for a configurable period (default 10 minutes) after selection.
- Redis TTL key (`seat:hold:<seatId>`) for fast expiry checks.
- BullMQ recurring job (every 30s) and a Node.js `setInterval` fallback scan for DB-level release of expired holds.

### Concurrency Protection
- **Distributed locks** via Redis `SET NX PX` -- per-seat, per-user, and per-batch locks serialize concurrent operations across server instances.
- **Prisma transactions** -- all seat-state mutations run inside `$transaction` with rollback on failure.
- **Conditional updates** -- `updateMany` with `WHERE status='HELD'` ensures no double-booking.
- **Idempotency keys** -- stored in the database with 24-hour expiry; duplicate creation requests return cached responses instead of creating duplicates.
- **Optimistic locking** -- `version` column on Seat increments on every update; stale writes affect zero rows.

### Waitlist Management
- FIFO queue per event + seat category.
- Automatic promotion when seats become available via cancellation or hold expiry.
- Time-limited offers (default 15 minutes) with delayed BullMQ expiry jobs.
- Cascading promotion: if an offer expires, the next waiting user is promoted automatically.

### QR Ticketing
- HMAC-SHA256 signed QR tokens prevent forgery.
- Tickets are emailed as QR images and verifiable at the venue via a public endpoint.
- Verification is logged in the `TicketVerification` table for audit.

### Email Notifications
- BullMQ-backed background email queue (or direct Resend API fallback when Redis is unavailable).
- Templates: booking confirmation, cancellation, waitlist promotion, waitlist expiry, password reset, email verification.
- Ethereal.email fallback for development when no credentials configured.

### Real-Time Updates
- Socket.IO rooms: `event:<eventId>` for seat status changes, `user:<userId>` for personal notifications.
- Events: `seatHeld`, `seatReleased`, `seatBooked`, `bookingCancelled`, `waitlistPromoted`, `notification`.

### Search
- Full-text search across movie titles, descriptions, categories, venue names, and cities.
- City filter support.

### Coupon System
- Admin-managed discount codes with percentage or fixed-amount discounts.
- Usage limits, minimum booking amounts, and expiration dates.

### Reviews & Ratings
- Customers can rate and review movies (one review per user per movie).
- Aggregate ratings shown with review count.

### Scraper Integration (BookMyShow / Parse API)
- Fetch now-showing movies and events from external API with DB caching.
- Import scraped data as movies/events/venues directly into the system.
- Configurable cache TTL (30 minutes) and manual refresh.

## Prerequisites

- **Node.js** 18+ (22 LTS recommended)
- **PostgreSQL** 16+
- **Redis** 7+ (optional -- queue/rate-limiting fallback to in-memory)
- **npm** 9+

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url>
cd ticket-booking
```

### 2. Install dependencies

```bash
# Backend
cd backend
npm install
npx prisma generate

# Frontend
cd ../frontend
npm install
```

### 3. Set up environment variables

```bash
cd ../backend
cp .env.example .env
```

Edit `.env` with your database URL, JWT secrets, and email credentials (see reference table below).

### 4. Start infrastructure (PostgreSQL + Redis)

Using Docker Compose:

```bash
cd ..
docker compose up -d postgres redis
```

### 5. Run database migrations and seed

```bash
cd backend
npx prisma migrate dev
npm run prisma:seed
```

### 6. Start the backend

```bash
cd backend
npm run dev
```

Backend starts at http://localhost:4000.

### 7. Start the frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

Frontend starts at http://localhost:3000.

### 8. Start the background worker (optional -- for BullMQ jobs)

```bash
cd backend
npm run worker:bullmq
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `JWT_SECRET` | (required) | Secret key for signing access tokens |
| `JWT_REFRESH_SECRET` | (required) | Secret key for signing refresh tokens |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL (used for CORS and email links) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `RESEND_API_KEY` | (empty) | Resend API key for email (production) |
| `RESEND_FROM_EMAIL` | (empty) | Verified sender email in Resend |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server host (fallback) |
| `SMTP_PORT` | `587` | SMTP server port (fallback) |
| `SMTP_USER` | (empty) | SMTP authentication username (fallback) |
| `SMTP_PASS` | (empty) | SMTP authentication password (fallback) |
| `EMAIL_FROM` | `noreply@ticketbooking.com` | From address for outgoing emails |
| `BULLMQ_JOB_ATTEMPTS` | `3` | Max retry attempts for BullMQ jobs |
| `BULLMQ_BACKOFF_DELAY_MS` | `5000` | Delay between BullMQ job retries |
| `SEAT_HOLD_TTL_MINUTES` | `10` | Duration a seat remains held before release |
| `WAITLIST_OFFER_TTL_MINUTES` | `15` | Duration a promoted waitlist offer stays valid |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `PARSE_API_KEY` | (empty) | API key for BookMyShow scraper (Parse.bot) |
| `PARSE_BASE_URL` | (empty) | Base URL for BookMyShow scraper API |

## Architecture Overview

### Backend Module Structure

```
backend/src/
  config/         -- Environment, Prisma client, Redis client
  middleware/     -- Auth (JWT), RBAC, rate limiting, validation, idempotency
  modules/        -- Feature modules (auth, movies, venues, events, seats,
  |                  bookings, waitlist, admin, dashboard, notifications,
  |                  qr, coupons, reviews, search, scraper)
  queues/         -- BullMQ connection, queue definitions, workers (email,
  |                  waitlist expiry, seat cleanup), fallback cron
  sockets/        -- Socket.IO initialization and room management
  routes/         -- Central Express router mounting all module routes
  utils/          -- ApiError, response helpers, Redis distributed locks,
                     audit log helper, async handler
```

Each module follows the same pattern: `*.routes.js` (HTTP routing + middleware wiring), `*.controller.js` (thin request/response handling), `*.service.js` (business logic), `*.validation.js` (Zod schemas).

### Frontend Pages

```
frontend/src/app/
  page.tsx                -- Landing page
  movies/page.tsx         -- Browse all movies/events
  movies/[id]/page.tsx    -- Movie detail with event list
  movies/[id]/book/       -- Seat selection and booking page
  bookings/page.tsx       -- User booking history
  bookings/[id]/page.tsx  -- Single booking detail
  bookings/[id]/cancel/   -- Booking cancellation
  ticket/[bookingId]/     -- QR ticket display
  waitlist/page.tsx       -- User waitlist entries
  notifications/page.tsx  -- Notification center
  login/page.tsx          -- Login form
  register/page.tsx       -- Registration form
  forgot-password/page.tsx
  reset-password/[token]/
  verify-email/page.tsx
  profile/page.tsx        -- User profile and settings
  admin/dashboard/        -- Admin analytics dashboard
  admin/users/            -- User management
  admin/venues/           -- Venue management
  organizer/dashboard/    -- Organizer analytics
  organizer/events/       -- Event management
  organizer/movies/       -- Movie management
  movies/scraper/[...]/   -- BookMyShow scraper import UI
```

## Key Technical Flows

### Seat Hold & TTL Mechanism

1. **User selects seats** → clicks "Hold" → `POST /seats/hold`
2. **Backend validates**: seats exist, are `AVAILABLE`, not held by others
3. **Atomic update**: seats → `HELD` + `heldBy=userId` + `heldAt=now()` + `version++`
4. **Redis key**: `seat:hold:{seatId}` = `{userId, expiresAt}` (TTL: 10 min)
5. **Response**: `{ heldSeats, expiresAt }` → frontend starts countdown

**Concurrency Prevention**
- Redis distributed lock: `booking:{eventId}:{userId}` (30s TTL)
- Optimistic locking: `version` column on Seat -- `UPDATE ... WHERE version = X`
- Double-check in transaction: `UPDATE seats SET status=BOOKED WHERE status=HELD AND version=X`

**TTL Expiration**
- Fallback cron (every 30s): releases seats where `heldAt < now() - 10min`
- Redis key expiry: auto-cleanup if Redis available
- On expiration: seats → `AVAILABLE`, lock released, frontend alerted via socket

### Waitlist Auto-Assignment Flow

**Joining Waitlist**
```
User clicks "Join Waitlist" for category
    ↓
Create WaitlistEntry: status=WAITING, position=MAX(position)+1
    ↓
Return position to user
    ↓
Background: send confirmation email (Resend API)
```

**Seat Freed (Cancel or Hold Expiry)**
```
Seat becomes AVAILABLE
    ↓
promoteWaitlist(eventId, seatId) called
    ↓
Find first WAITING entry for seat.category ORDER BY position ASC
    ↓
Update entry: status=PROMOTED
    ↓
Seat → HELD for that user (15 min offer TTL)
    ↓
Notify via: Socket (waitlistPromoted) + Email (Resend) + Notification table
    ↓
Queue job: waitlist:offer-expiry (delay=15min) → expireOffer()
```

**Offer Expiry**
```
If user doesn't book within 15 min:
    ↓
    Seat → AVAILABLE
    ↓
    WaitlistEntry → EXPIRED
    ↓
    Notify user (email + socket)
    ↓
    Promote next in line (recursive)
```

### Time-Limited Offer Handling

| Component | Duration | Purpose |
|-----------|----------|---------|
| **Seat Hold TTL** | 10 minutes | User selects → holds seats |
| **Booking Lock** | 30 seconds | Prevents double-booking during payment |
| **Waitlist Offer TTL** | 15 minutes | Promoted user must book |
| **Access Token** | 15 minutes | JWT expiry, auto-refresh via refresh token |
| **Refresh Token** | 7 days | Long-lived, rotates on use |
| **Cleanup Cron** | Every 30s | Fallback for expired holds |

## Deployment

### Railway (Backend + PostgreSQL + Redis)
1. New Project → Add PostgreSQL, Redis
2. Add Backend service → Root: `ticket-booking/backend`
3. Variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
4. Start Command: `npx prisma migrate deploy && node src/server.js`

### Vercel (Frontend)
1. Import GitHub repo → Root: `ticket-booking/frontend`
2. Variables: `NEXT_PUBLIC_API_URL=https://your-railway-url/api`, `NEXT_PUBLIC_WS_URL=https://your-railway-url`
3. Deploy

## Testing Checklist

- [ ] Register/Login → JWT tokens stored
- [ ] Browse movies → select event → seat map loads
- [ ] Select seats → Hold → countdown starts (10 min)
- [ ] Hold expires → seats released → alert shown
- [ ] Confirm booking → instant QR in response (no 2nd API call)
- [ ] Cancel booking → instant → waitlist promoted
- [ ] Join waitlist → instant → promotion email sent
- [ ] QR scan → `/ticket/:id` shows verified

## Project Structure

```
ticket-booking/
├── backend/
│   ├── prisma/schema.prisma      # DB schema
│   ├── src/
│   │   ├── config/               # env, prisma, redis
│   │   ├── middleware/           # auth, validation, idempotency
│   │   ├── modules/
│   │   │   ├── auth/             # JWT, register, login
│   │   │   ├── bookings/         # booking service/controller
│   │   │   ├── seats/            # hold, release, cleanup
│   │   │   ├── waitlist/         # join, promote, expire
│   │   │   ├── qr/               # QR generate/verify
│   │   │   └── ...
│   │   ├── queues/               # BullMQ workers (email, waitlist)
│   │   ├── sockets/              # Socket.IO real-time
│   │   ├── utils/                # ApiError, redisLock, etc.
│   │   ├── app.js                # Express app
│   │   └── server.js             # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   ├── components/           # SeatMap, UI components
│   │   ├── lib/                  # api client, auth context, socket
│   │   └── ...
│   └── package.json
└── README.md
```

## Key Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| JWT Auth (access + refresh) | ✅ | Auto-refresh on 401 |
| Seat hold with TTL | ✅ | 10 min, Redis + cron fallback |
| Distributed locking | ✅ | Redis + in-memory fallback |
| Waitlist with promotion | ✅ | FIFO, 15 min offer window |
| Instant QR confirmation | ✅ | Returned in booking response |
| Real-time seat updates | ✅ | Socket.IO |
| Background email queue | ✅ | BullMQ → Resend API (HTTPS) |
| Queue dashboard | ✅ | Bull Board at `/admin/queues` |
| Idempotent bookings | ✅ | Header-based |
| Audit logging | ✅ | All critical actions |

## License

MIT License - © 2026 Yash Dubal