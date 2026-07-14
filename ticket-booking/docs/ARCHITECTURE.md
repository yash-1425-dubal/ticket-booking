# Ticket Booking System -- Architecture

## Overview

The Ticket Booking System is a full-stack web application for discovering events, selecting seats interactively, booking tickets, and managing waitlists. It is built with a Node.js/Express backend, a Next.js frontend, PostgreSQL for persistence, Redis for caching and distributed locking, Kafka for event streaming, and BullMQ for background job processing.

---

## System Diagram

```
                        +-------------------+
                        |   Next.js Frontend |
                        |   (port 3000)      |
                        +--------+----------+
                                 |
                        HTTP API | Socket.IO
                                 |
                        +--------v----------+
                        |   Express Backend  |
                        |   (port 4000)      |
                        +---+----+----+-----+
                            |    |    |
                     +------+    |    +------+
                     |           |           |
              +------v---+ +----v---+ +-----v------+
              | Postgres | |  Redis  | |   BullMQ   |
              | (data)   | | (cache) | | (queues)   |
              +----------+ +--------+ +------------+
                     |
                     | (optional)
              +------v------+
              | Apache Kafka |
              | (streaming)  |
              +-------------+
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, TypeScript | SPA with SSR/CSR |
| Styling | TailwindCSS 3 | Utility-first CSS |
| Backend | Node.js, Express 5 | REST API |
| ORM | Prisma 7 | Database access & migrations |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | Seat hold TTL, distributed locks, idempotency |
| Job Queue | BullMQ (backed by Redis) | Email, waitlist promotion, seat cleanup |
| Streaming | Apache Kafka (optional) | Event streaming for analytics |
| Real-time | Socket.IO | Live seat updates, notifications |
| Auth | JWT (access + refresh tokens) | Stateless authentication |

---

## Project Structure

```
ticket-booking/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Data model (13 models, 9 enums)
│   │   ├── migrations/            # Migration history
│   │   └── seed.js                # Demo data seeder
│   └── src/
│       ├── server.js              # Entry point (HTTP + Socket.IO)
│       ├── app.js                 # Express app setup
│       ├── config/
│       │   ├── env.js             # Environment variable loader
│       │   ├── prisma.js          # Prisma client singleton
│       │   └── redis.js           # Redis (ioredis) client
│       ├── middleware/
│       │   ├── auth.middleware.js         # JWT verification
│       │   ├── role.middleware.js         # RBAC enforcement
│       │   ├── validateRequest.middleware.js  # Zod schema validation
│       │   ├── idempotency.middleware.js  # Idempotency key handling
│       │   ├── rateLimiter.js             # Sliding-window rate limiter
│       │   └── error.middleware.js        # Global error handler
│       ├── modules/               # Feature modules (see below)
│       ├── queues/
│       │   ├── connection.js      # BullMQ Redis connection
│       │   ├── queues.js          # Queue definitions
│       │   ├── workers.js         # Job processors
│       │   └── fallbackCron.js    # DB-based cleanup fallback
│       ├── sockets/
│       │   └── index.js           # Socket.IO setup & room management
│       └── utils/
│           ├── ApiError.js        # Custom error class
│           ├── asyncHandler.js    # Async route wrapper
│           ├── response.js        # Standardized JSON response
│           ├── redisLock.js       # Distributed lock helper
│           ├── audit.js           # Audit logging
│           ├── safeUser.js        # User serialization helper
│           └── memoryCache.js     # In-memory TTL cache
├── frontend/
│   └── src/
│       ├── app/                   # Next.js App Router pages (14 routes)
│       ├── components/
│       │   ├── Navbar.tsx         # Navigation bar
│       │   ├── SeatMap.tsx        # Interactive seat grid
│       │   ├── AuthGuard.tsx      # Route protection wrapper
│       └── lib/
│           ├── api.ts             # API client (token management)
│           ├── auth-context.tsx    # React context for auth state
│           └── useSocket.ts       # Socket.IO React hook
├── docker/
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
└── docker-compose.yml
```

---

## Backend Modules

Each module follows a feature-based structure: `routes.js`, `controller.js`, `service.js`, and optional `validation.js`.

| Module | Endpoints | Description |
|--------|-----------|-------------|
| `auth` | register, login, refresh, me, logout | JWT authentication with access + refresh tokens |
| `venues` | CRUD | Venue management (admin only for mutations) |
| `movies` | CRUD, search, filter | Movie/event listings with poster and metadata |
| `events` | CRUD | Show times linked to movies with auto seat generation |
| `seats` | map, hold, release | Interactive seat map, Redis-backed hold with 10-min TTL |
| `bookings` | create, list, get, cancel | Idempotent booking creation with seat locking |
| `qr` | generate, verify | HMAC-signed QR ticket generation and scanner verification |
| `waitlist` | join, position, leave | FIFO waitlist with auto-promotion on seat availability |
| `dashboard` | admin, organizer | Aggregated analytics (revenue, occupancy, bookings) |
| `notifications` | list, markRead, markAllRead | In-app notification center |
| `admin` | users, bookings | System-wide admin management |
| `search` | events, venues | Full-text search across events and movies |
| `scraper` | scrape, list, cache | Movie data scraper with Redis caching |
| `coupons` | CRUD, validate | Discount coupon management |
| `reviews` | create, list, update, delete | Movie ratings and reviews |
| `payments` | process | Payment processing (extensible) |

---

## Data Flow: Booking Lifecycle

```
1. BROWSE  -->  User searches/ browses movies and events
2. SELECT  -->  User clicks seats on interactive SeatMap component
3. HOLD    -->  POST /api/events/:eventId/seats/hold
                ├── Redis SET NX PX 600000 (seat hold key)
                └── Prisma UPDATE seat SET status=HELD (optimistic lock via version)
4. CHECKOUT -->  POST /api/bookings (with idempotencyKey)
                ├── Validates all seats are HELD by this user
                ├── Creates Booking + BookingSeats + Payment records
                ├── Updates seats to BOOKED
                ├── Enqueues email job (BullMQ)
                ├── Broadcasts seatBooked (Socket.IO)
                └── Returns QR ticket data
5. TICKET   -->  User views QR ticket (HMAC-signed, server-validated)
6. CANCEL   -->  POST /api/bookings/:id/cancel
                ├── Frees seats to AVAILABLE
                ├── Triggers waitlist promotion cascade
                └── Sends cancellation email
```

---

## Data Flow: Seat Hold TTL

```
User selects seats
       │
       v
Hold request arrives at backend
       │
       ├── Redis distributed lock: lock:seat:<seatId> (SET NX PX 2000)
       │       └── Serializes concurrent requests across instances
       │
       ├── Prisma UPDATE seats SET status=HELD, version=version+1
       │       └── Optimistic lock: WHERE version=oldVersion
       │           └── Second writer updates 0 rows -> rejected
       │
       └── Redis TTL key: seat:hold:<seatId> (SET NX PX 600000 = 10 min)
               └── Fast in-memory check before DB queries
                    │
            ┌───────┴────────┐
            v                v
    User books          BullMQ cleanup job (every 30s)
         │                    │
         v                    v
    Seat → BOOKED       Finds expired holds
                            │
                            v
                    Seat → AVAILABLE
                    Redis key deleted
                    Socket.IO: seatReleased
```

---

## Waitlist Flow

```
1. JOIN: User joins waitlist for (eventId, category)
   ├── Assigned MAX(position) + 1 for FIFO ordering
   └── Socket.IO: waitlistPositionUpdate

2. PROMOTE: When a seat becomes available (cancel/expire)
   ├── Query WAITING entry with MIN(position) for (eventId, category)
   ├── Status → PROMOTED, seat → HELD for promoted user
   ├── Notification created, email enqueued
   ├── BullMQ delayed job: offer-expiry (15-min TTL)
   └── Socket.IO: waitlistPromoted

3. OFFER EXPIRY (15 min): User did not book
   ├── Seat released back to AVAILABLE
   ├── Notification: WAITLIST_EXPIRED
   └── promoteWaitlist() cascades to next user

4. BOOK: User books within offer window
   ├── Normal booking flow with idempotency
   └── Offer-expiry job becomes no-op (seat no longer held)
```

---

## Concurrency Model

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Application | Redis distributed lock (SET NX PX 2000) | Per seat, across instances |
| Database | Prisma transaction | Atomic multi-seat operations |
| Database | Optimistic locking (version column) | Per seat row |
| Client | Idempotency key (UUID) | Per booking request |
| Client | Frontend state | Disables double-click on book button |

---

## Real-Time Events (Socket.IO)

| Event | Direction | Trigger | Payload |
|-------|-----------|---------|---------|
| `join-event` | Client -> Server | Enter seat map page | `eventId` |
| `leave-event` | Client -> Server | Leave seat map page | `eventId` |
| `join-user` | Client -> Server | Login / app load | `userId` |
| `seatHeld` | Server -> Client | Seat hold success | `{ seatId, userId, expiresAt }` |
| `seatReleased` | Server -> Client | Hold expiry / cancel | `{ seatId }` |
| `seatBooked` | Server -> Client | Booking confirmed | `{ seatId, bookingId }` |
| `waitlistPromoted` | Server -> Client | Waitlist promotion | `{ eventId, category }` |
| `waitlistPositionUpdate` | Server -> Client | Position changed | `{ eventId, position }` |
| `notification` | Server -> Client | New notification | `{ notification }` |

---

## BullMQ Queues

| Queue | Job | Processor | Description |
|-------|-----|-----------|-------------|
| `email` | `send-email` | Nodemailer | Sends booking confirmation, waitlist promotion, cancellation emails |
| `seat-cleanup` | `cleanup-expired-holds` | DB scan | Recurring job every 30s; releases seats held beyond 10-min TTL |
| `waitlist` | `offer-expiry` | Delayed job | Fires 15 min after promotion; releases unbooked seats back to pool |
| `seed` | `import-movies` | Scraper data | Bulk-imports scraped movie data into the database |

A fallback cron (`queues/fallbackCron.js`) runs a `setInterval`-based seat cleanup at 30-second intervals as a safety net when BullMQ workers are unavailable (e.g., Redis is down).

---

## Rate Limiting

| Scope | Window | Max Requests | Applies To |
|-------|--------|-------------|------------|
| Auth endpoints | 60 seconds | 20 | `/api/auth/*` |
| All other API | 60 seconds | 100 | `/api/*` (except auth) |

Rate limiting uses a sliding-window counter stored in a `Map` in the middleware process memory. Restarting the server resets all counters.

---

## Error Handling

The backend uses a centralized error handler (`error.middleware.js`). Controllers throw `ApiError` instances:

```
ApiError(statusCode, message, details?)
```

Standard error response shape:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": []       // Optional validation errors
}
```

HTTP status codes used: 200, 201, 400, 401, 403, 404, 409, 429, 500.

---

## Audit Logging

All state-changing operations (login, booking, cancellation, admin actions) are recorded in the `AuditLog` table with:
- `userId` (actor)
- `action` (e.g., `BOOKING_CREATED`, `SEAT_HELD`)
- `entityType` + `entityId` (affected resource)
- `metadata` (JSON with operation details)
- `ipAddress`, `userAgent`

---

## Security

- **Helmet**: Security headers (CSP, X-Frame-Options, etc.)
- **CORS**: Restricted to `FRONTEND_URL` with credentials
- **JWT**: Short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
- **Password hashing**: bcryptjs with salt rounds
- **QR tickets**: HMAC-signed with server secret to prevent forgery
- **Rate limiting**: Per-endpoint sliding window limits
- **Input validation**: Zod schemas on all mutation endpoints
- **Idempotency**: Safe against duplicate submissions via idempotency keys
