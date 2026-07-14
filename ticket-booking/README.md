# Ticket Booking System

A full-stack ticket booking platform with real-time seat selection, waitlist management, QR ticket verification, and email notifications. Supports movies, concerts, theater shows, and events with role-based access for customers, organizers, and administrators.

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
- BullMQ-backed background email queue (or direct Nodemailer fallback when Redis is unavailable).
- Template: booking confirmation, cancellation, waitlist promotion, waitlist expiry, password reset, email verification.
- Ethereal.email fallback for development when no SMTP is configured.

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

Edit `.env` with your database URL, JWT secrets, and SMTP credentials (see reference table below).

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
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | (empty) | SMTP authentication username |
| `SMTP_PASS` | (empty) | SMTP authentication password |
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

## Scripts Reference

### Backend

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `nodemon src/server.js` | Start backend with hot-reload |
| `start` | `node src/server.js` | Start backend in production |
| `prisma:generate` | `prisma generate` | Generate Prisma client |
| `prisma:migrate` | `prisma migrate dev` | Run pending migrations |
| `prisma:studio` | `prisma studio` | Open Prisma Studio GUI |
| `prisma:seed` | `node prisma/seed.js` | Seed database with demo data |
| `worker:bullmq` | `node src/queues/workers.js` | Start BullMQ background worker |
| `test` | `jest --runInBand` | Run tests |

### Frontend

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start dev server on port 3000 |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |

### Docker

```bash
# Start all services (PostgreSQL, Redis, backend, frontend)
docker compose up --build

# Start infrastructure only
docker compose up -d postgres redis
```

## Demo Accounts

After seeding, log in with:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ticketbook.com | admin123 |
| Organizer | organizer@ticketbook.com | organizer123 |
| Customer | customer@ticketbook.com | customer123 |

## Docker Deployment

```bash
docker compose up --build
```

This starts PostgreSQL (port 5433), Redis (6379), backend (4000), and frontend (3000). The Dockerfile.backend uses multi-stage with `prisma migrate deploy` on startup. The Dockerfile.frontend builds to Next.js standalone output.
