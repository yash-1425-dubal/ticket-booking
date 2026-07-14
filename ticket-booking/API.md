# Ticket Booking API Documentation

Base URL: `http://localhost:4000/api`

## Authentication

All protected endpoints require a JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Auth Endpoints

#### POST /api/auth/register
Register a new user.

**Body:**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "securepass", "role": "CUSTOMER" }
```
`role` can be `CUSTOMER`, `ORGANIZER`, or `ADMIN` (default: `CUSTOMER`).

**Response:** `201`
```json
{ "status": "success", "data": { "user": { "id": "...", "name": "John Doe", "email": "john@example.com", "role": "CUSTOMER" }, "tokens": { "accessToken": "...", "refreshToken": "..." } } }
```

#### POST /api/auth/login
**Body:** `{ "email": "...", "password": "..." }`

**Response:** `200` — same format as register.

#### POST /api/auth/refresh
**Body:** `{ "refreshToken": "..." }`

**Response:** `200` — new access + refresh tokens.

#### POST /api/auth/logout
**Auth:** Required. **Body:** `{ "refreshToken": "..." }`

**Response:** `200` — invalidates the refresh token.

#### GET /api/auth/me
**Auth:** Required.

**Response:** `200` — current user profile.

#### PATCH /api/auth/me
**Auth:** Required. **Body:** `{ "name?": "...", "password?": "..." }`

**Response:** `200` — updated user.

---

## Movies

#### GET /api/movies
List all movies with their venue and next scheduled event.

**Query:** `?city=cityname` (optional, filter by venue city)

**Response:** `200`
```json
{ "status": "success", "data": [{ "id": "uuid", "title": "...", "posterUrl": "...", "description": "...", "category": "...", "venue": { "id": "uuid", "name": "...", "city": "..." }, "nextEvent": { "id": "uuid", "startTime": "ISO", "endTime": "ISO" } }] }
```

#### GET /api/movies/:id
Get a single movie with venue, organizer, and all its events.

**Response:** `200` — movie details.

#### POST /api/movies
**Auth:** Organizer/Admin.

**Body:**
```json
{ "title": "...", "description": "...", "posterUrl": "...", "language": "...", "category": "General", "venueId": "uuid" }
```

**Response:** `201`

#### PATCH /api/movies/:id
**Auth:** Organizer (owner) or Admin.

**Body:** Any subset of create fields.

**Response:** `200`

#### DELETE /api/movies/:id
**Auth:** Organizer (owner) or Admin.

**Response:** `200` — sets movie status to `DELETED`.

---

## Venues

#### GET /api/venues
List all venues.

**Response:** `200`
```json
{ "status": "success", "data": [{ "id": "uuid", "name": "...", "address": "...", "city": "...", "totalRows": 10, "seatsPerRow": 10 }] }
```

#### GET /api/venues/:id
**Response:** `200` — venue with its movies.

#### POST /api/venues
**Auth:** Admin.

**Body:**
```json
{ "name": "...", "address": "...", "city": "...", "totalRows": 10, "seatsPerRow": 10 }
```

**Response:** `201`

#### PATCH /api/venues/:id
**Auth:** Admin. **Body:** Any subset of create fields.

**Response:** `200`

#### DELETE /api/venues/:id
**Auth:** Admin.

**Response:** `200`

---

## Events

#### GET /api/events/:id
Get event details with movie, venue, organizer, and seat/booking counts.

**Response:** `200`

#### POST /api/events
**Auth:** Organizer (owner of the movie).

**Body:**
```json
{
  "movieId": "uuid",
  "startTime": "2026-07-15T14:00:00.000Z",
  "endTime": "2026-07-15T17:00:00.000Z",
  "seatPricing": { "PREMIUM": 500, "STANDARD": 300, "ECONOMY": 180 }
}
```
`seatPricing` is optional — defaults: PREMIUM=500, STANDARD=300, ECONOMY=180.

**Response:** `201` — event with auto-generated seats.

#### PATCH /api/events/:id
**Auth:** Organizer (owner). **Body:** `{ "startTime?": "...", "endTime?": "...", "status?": "SCHEDULED|ACTIVE|COMPLETED|CANCELLED" }`

**Response:** `200`

#### DELETE /api/events/:id
**Auth:** Organizer (owner). Sets status to `CANCELLED`.

**Response:** `200`

---

## Seats

#### POST /api/seats/hold
**Auth:** Customer.

**Body:**
```json
{ "eventId": "uuid", "seatIds": ["uuid1", "uuid2"], "ttlMinutes": 10 }
```
`ttlMinutes` defaults to `SEAT_HOLD_TTL_MINUTES` env (10 min).

**Response:** `200`
```json
{ "status": "success", "data": { "heldSeats": [...], "expiresAt": "ISO" } }
```

Uses distributed lock per seat (Redis or in-memory fallback) to prevent concurrent holds.

#### POST /api/seats/release
**Auth:** Customer.

**Body:** `{ "seatIds": ["uuid1", "uuid2"] }`

**Response:** `200`

---

## Bookings

#### POST /api/bookings
**Auth:** Customer.

**Body:**
```json
{ "eventId": "uuid", "seatIds": ["uuid1", "uuid2"] }
```

Idempotency key is required via `Idempotency-Key` header.

**Flow:** Distributed lock → Prisma transaction → verify all seats HELD + owned by user → updateMany to BOOKED → create Booking + BookingSeats + Payment → clear Redis TTL → Socket.IO broadcast `seatsBooked` → notification → QR email → audit log.

**Response:** `201`
```json
{ "status": "success", "data": { "booking": { "id": "uuid", "status": "CONFIRMED", "totalAmount": 800, "bookingSeats": [...], "payment": { "status": "COMPLETED", "amount": 800 } } } }
```
QR code is emailed to the user's registered email.

#### GET /api/bookings
**Auth:** Customer. List own bookings.

**Query:** `?page=1&limit=10&status=CONFIRMED`

**Response:** `200` — paginated bookings with event, seats, payment info.

#### GET /api/bookings/:id
**Auth:** Customer (owner) or Admin.

**Response:** `200` — full booking details.

#### POST /api/bookings/:id/cancel
**Auth:** Customer (owner).

**Response:** `200` — seats released, payment status set to `REFUNDED`, waitlist promoted.

---

## Waitlist

#### POST /api/waitlist
**Auth:** Customer.

**Body:** `{ "eventId": "uuid", "category": "PREMIUM" }`

**Response:** `201`
```json
{ "status": "success", "data": { "id": "uuid", "position": 3, "status": "WAITING" } }
```

#### GET /api/waitlist/my
**Auth:** Customer. List own waitlist entries.

#### GET /api/waitlist/event/:eventId
**Auth:** Organizer/Admin. View waitlist for an event.

#### DELETE /api/waitlist/:id
**Auth:** Customer (owner). Cancel waitlist entry.

---

## Notifications

#### GET /api/notifications
**Auth:** Required. List user's notifications.

**Query:** `?unread=true`

**Response:** `200`
```json
{ "status": "success", "data": [{ "id": "uuid", "type": "BOOKING_CONFIRMED", "message": "...", "read": false, "createdAt": "ISO" }] }
```

#### PATCH /api/notifications/:id/read
**Auth:** Required. Mark as read.

#### POST /api/notifications/read-all
**Auth:** Required. Mark all as read.

---

## Email Logs (Admin)

#### GET /api/email-logs
**Auth:** Admin. Paginated email log.

---

## Audit Logs (Admin)

#### GET /api/audit-logs
**Auth:** Admin. Paginated audit log.

---

## Ticket Verification

#### POST /api/tickets/verify
**Auth:** Organizer/Admin.

**Body:** `{ "ticketToken": "..." }`

**Response:** `200` — ticket validity, seat info, event details.

---

## Search

#### GET /api/search
**Query:** `?q=searchterm&city=pune&type=movie`

Types: `movie`, `event`, `venue`. Filters by city and searches by title/name.

---

## Dashboard

#### GET /api/dashboard/organizer
**Auth:** Organizer.

**Response:** `200`
```json
{ "totalBookings": 42, "totalRevenue": 12600, "cancelledBookings": 3, "occupancyRate": 78.5, "waitlistCount": 12, "movies": [{ "title": "...", "totalBookings": 20, "revenue": 6000 }] }
```

#### GET /api/dashboard/admin
**Auth:** Admin.

**Response:** `200` — users by role, events by status/movies, bookings by status, venue count.

---

## Scraper (BookMyShow Import)

#### GET /api/organizer/movies
**Auth:** Optional (unauthenticated browsing allowed). Query: `?city=pune`

Returns recommended movies from BookMyShow.

#### GET /api/organizer/events
**Auth:** Optional. Query: `?city=pune`

Returns event list from BookMyShow.

#### GET /api/organizer/movie-details
**Auth:** Optional. Query: `?city=pune&eventCode=ET00496605`

Returns movie details from BookMyShow.

#### POST /api/organizer/refresh-cache
**Auth:** Organizer. **Body:** `{ "city": "pune", "eventCode?": "ET00496605" }`

Refreshes cached movie/event data.

#### POST /api/organizer/import-scraper-movie
**Auth:** Organizer.

**Body:**
```json
{
  "title": "...", "description": "...", "posterUrl": "...",
  "venueName": "...", "venueCity": "pune", "eventDate": "2026-07-20T14:00:00Z",
  "seatPricing": { "PREMIUM": 600, "STANDARD": 350, "ECONOMY": 200 }
}
```

**Response:** `201` — movie, event, venue, and seats auto-created.

---

## Tickets (QR Verification)

#### POST /api/tickets/verify
Verify a QR ticket by HMAC token.

---

## Error Format

All errors follow this structure:

```json
{
  "status": "error",
  "message": "Human-readable error description"
}
```

Common status codes: `400` (Bad Request), `401` (Unauthorized), `403` (Forbidden), `404` (Not Found), `409` (Conflict), `429` (Too Many Requests), `500` (Internal Server Error).

Validation errors include field details:
```json
{
  "status": "error",
  "message": "...",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```
