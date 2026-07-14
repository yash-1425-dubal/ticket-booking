# Ticket Booking System -- API Reference

Base URL: `http://localhost:4000/api`

All responses follow a standard envelope:

```json
{
  "success": true | false,
  "data": { ... },
  "message": "..."
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error description",
  "details": ["Optional validation errors"]
}
```

---

## Authentication

All authenticated endpoints require the `Authorization: Bearer <token>` header.

### POST /auth/register

Create a new user account.

```
Body: {
  "name": "string (2-100 chars)",
  "email": "string (valid email)",
  "password": "string (6-100 chars)",
  "role": "CUSTOMER | ORGANIZER"  // optional, default: CUSTOMER
}

Response 201: {
  "user": { "id", "name", "email", "role", "isEmailVerified" },
  "accessToken": "string",
  "refreshToken": "string"
}
```

### POST /auth/login

Authenticate and receive tokens.

```
Body: {
  "email": "string",
  "password": "string"
}

Response 200: {
  "user": { "id", "name", "email", "role", "isEmailVerified" },
  "accessToken": "string",
  "refreshToken": "string"
}
```

### POST /auth/refresh

Exchange a refresh token for a new access token.

```
Body: { "refreshToken": "string" }
Response 200: { "accessToken": "string", "refreshToken": "string" }
```

### POST /auth/forgot-password

Request a password reset email.

```
Body: { "email": "string" }
Response 200: { "message": "Password reset email sent" }
```

### POST /auth/reset-password/:token

Reset password using token from email.

```
Body: { "password": "string (6-100 chars)" }
Response 200: { "message": "Password reset successful" }
```

### GET /auth/me

Get current authenticated user profile. _(Auth required)_

```
Response 200: {
  "user": { "id", "name", "email", "role", "isEmailVerified", "createdAt" }
}
```

### PATCH /auth/me

Update profile. _(Auth required)_

```
Body (at least one): {
  "name": "string (2-100)",
  "email": "string",
  "currentPassword": "string",   // required if setting newPassword
  "newPassword": "string (6-100)"
}
Response 200: { "user": { ... } }
```

### POST /auth/verify-email/:token

Verify email address using token.

```
Response 200: { "message": "Email verified successfully" }
```

### POST /auth/resend-verification

Resend email verification link. _(Auth required)_

```
Response 200: { "message": "Verification email sent" }
```

---

## Venues

### GET /api/venues

List all venues.

```
Query: ?city=string (optional filter)
Response 200: [{ "id", "name", "address", "city", "totalRows", "seatsPerRow" }]
```

### GET /api/venues/cities

List distinct cities with venues.

```
Response 200: ["City1", "City2", ...]
```

### GET /api/venues/:id

Get venue by ID.

```
Response 200: { "id", "name", "address", "city", "totalRows", "seatsPerRow", "movies": [...] }
```

### POST /api/venues

Create venue. _(Admin only)_

```
Body: {
  "name": "string",
  "address": "string",
  "city": "string",
  "totalRows": "number",
  "seatsPerRow": "number"
}
Response 201: { "id", ... }
```

### PATCH /api/venues/:id

Update venue. _(Admin only)_

### DELETE /api/venues/:id

Delete venue. _(Admin only)_

```
Response 200: { "message": "Venue deleted successfully" }
```

---

## Movies

### GET /api/movies

List all movies with filtering and search.

```
Query: {
  ?search=string     (full-text search on title)
  ?status=DRAFT|PUBLISHED|COMPLETED|CANCELLED
  ?category=string
  ?venueId=uuid
  ?city=string
  ?organizerId=uuid
  ?page=number       (default: 1)
  ?limit=number      (default: 20, max: 50)
}
Response 200: {
  "movies": [{ "id", "title", "description", "posterUrl", "language", "venue", "status", "category", "events": [...] }],
  "total": number,
  "page": number,
  "limit": number
}
```

### GET /api/movies/mine

List movies created by the authenticated organizer. _(Organizer or Admin)_

```
Response 200: { "movies": [...] }
```

### GET /api/movies/:id

Get movie by ID.

```
Response 200: {
  "id", "title", "description", "posterUrl", "language", "ctaUrl",
  "venue": { "id", "name", "city" },
  "organizer": { "id", "name" },
  "status", "category",
  "events": [{ "id", "startTime", "endTime", "status" }]
}
```

### POST /api/movies

Create movie. _(Organizer or Admin)_

```
Body: {
  "title": "string",
  "description": "string",
  "posterUrl": "string (optional)",
  "language": "string (optional)",
  "ctaUrl": "string (optional)",
  "venueId": "uuid",
  "category": "string (optional)",
  "status": "DRAFT | PUBLISHED (optional)"
}
Response 201: { "id", ... }
```

### PATCH /api/movies/:id

Update movie. _(Organizer or Admin)_

### DELETE /api/movies/:id

Delete movie. _(Organizer or Admin)_

---

## Events (Shows)

### POST /api/events

Create a show for a movie with auto-generated seats. _(Organizer or Admin)_

```
Body: {
  "movieId": "uuid",
  "startTime": "ISO 8601 datetime",
  "endTime": "ISO 8601 datetime",
  "status": "SCHEDULED | ONGOING | COMPLETED | CANCELLED (optional)"
}
Response 201: {
  "id", "movieId", "startTime", "endTime", "status",
  "seats": [{ "id", "seatNumber", "row", "col", "category", "price", "status" }]
}
```

On creation, seats are automatically generated based on the movie's venue's `totalRows` and `seatsPerRow`. Seat categories are distributed: first 2 rows = PREMIUM, last 2 rows = ECONOMY, rest = STANDARD.

### GET /api/events/:id

Get event by ID with seat summary.

```
Response 200: {
  "id", "movieId", "startTime", "endTime", "status",
  "movie": { "title", "posterUrl", ... },
  "seatSummary": { "total", "available", "held", "booked" }
}
```

### PATCH /api/events/:id

Update event. _(Organizer or Admin)_

### DELETE /api/events/:id

Delete event and associated seats. _(Organizer or Admin)_

---

## Seats

All seat routes are mounted at `/api/events/:eventId/seats`.

### GET /api/events/:eventId/seats

Get the complete seat map for an event.

```
Response 200: {
  "eventId": "uuid",
  "seats": [
    {
      "id": "uuid",
      "seatNumber": "A1",
      "row": 1,
      "col": 1,
      "category": "PREMIUM | STANDARD | ECONOMY",
      "price": "10.00",
      "status": "AVAILABLE | HELD | BOOKED",
      "heldBy": "uuid | null"
    }
  ]
}
```

The frontend `SeatMap` component renders this as an interactive grid, color-coded by status and category.

### POST /api/events/:eventId/seats/hold

Hold seats for booking (10-minute TTL). _(Auth required)_

```
Body: { "seatIds": ["uuid", "uuid", ...] }    // 1-10 seats
Response 200: {
  "heldSeats": ["uuid", ...],
  "expiresAt": "ISO 8601 datetime"
}
```

Concurrent hold protection:
1. Redis distributed lock per seat (`SET NX PX 2000`)
2. Optimistic lock via `version` column in database
3. Redis TTL key (`seat:hold:<seatId>`, `PX 600000`)

### POST /api/events/:eventId/seats/release

Release held seats before TTL expiry. _(Auth required)_

```
Body: { "seatIds": ["uuid", "uuid", ...] }
Response 200: { "message": "Seats released", "releasedSeats": ["uuid", ...] }
```

Broadcasts `seatReleased` via Socket.IO to the event room.

---

## Bookings

### POST /api/bookings/:eventId

Create a booking. _(Auth required, idempotent)_

```
Headers: { "Idempotency-Key": "uuid" }   // required

Body: {
  "seatIds": ["uuid", "uuid", ...],       // 1-10 seats, must be HELD by user
  "couponCode": "string (optional)"
}
Response 201: {
  "booking": {
    "id": "uuid",
    "userId": "uuid",
    "eventId": "uuid",
    "status": "CONFIRMED",
    "totalAmount": "50.00",
    "createdAt": "ISO 8601"
  },
  "seats": [{ "id", "seatNumber", "row", "col", "category", "price" }],
  "payment": { "id", "amount", "method": "CARD", "status": "PAID", "paidAt" },
  "qrData": { "qrCode": "base64 PNG", "secret": "hmac-secret", "bookingId": "uuid" }
}
```

Idempotency: If the same `Idempotency-Key` is sent again, the existing booking is returned instead of creating a duplicate. The key is scoped per-user.

### GET /api/bookings

List authenticated user's bookings.

```
Query: ?status=CONFIRMED|CANCELLED|REFUNDED (optional filter)
Response 200: [{ "id", "event", "seats", "totalAmount", "status", "createdAt" }]
```

### GET /api/bookings/:id

Get booking by ID.

```
Response 200: {
  "id", "status", "totalAmount", "createdAt",
  "event": { "id", "startTime", "endTime", "movie": { "title", "posterUrl" } },
  "seats": [{ "seatNumber", "row", "col", "category", "price" }],
  "payment": { "amount", "method", "status", "paidAt" }
}
```

### POST /api/bookings/:id/cancel

Cancel a booking. _(Auth required, must own booking or be admin)_

```
Body: { "reason": "string (optional, max 500 chars)" }
Response 200: { "message": "Booking cancelled", "booking": { "id", "status": "CANCELLED", ... } }
```

On cancellation: seats are released to `AVAILABLE`, and the waitlist promotion cascade is triggered via `promoteWaitlist()`.

---

## QR Tickets

### GET /api/qr/:bookingId/qr

Get QR code for a booking. _(Auth required, must own booking)_

```
Response 200: {
  "qrCode": "data:image/png;base64,...",
  "bookingId": "uuid",
  "event": { "title", "startTime" },
  "seats": ["A1", "A2"]
}
```

### GET /api/qr/:bookingId/verify

Verify a ticket QR code (public -- no auth required, for scanner use).

```
Query: ?secret=string  (the HMAC secret embedded in the QR)
Response 200: {
  "valid": true,
  "booking": {
    "id", "status": "CONFIRMED",
    "event": { "title", "startTime", "venue": { "name", "city" } },
    "seats": [{ "seatNumber", "row", "col", "category" }],
    "user": { "name", "email" }
  }
}

Error 404: { "valid": false, "message": "Invalid or expired QR code" }
```

---

## Waitlist

### POST /api/waitlist/join

Join waitlist for a specific event and seat category. _(Auth required)_

```
Body: {
  "eventId": "uuid",
  "category": "PREMIUM | STANDARD | ECONOMY"
}
Response 200: {
  "entry": {
    "id": "uuid",
    "eventId": "uuid",
    "category": "PREMIUM",
    "position": 3,
    "status": "WAITING"
  },
  "message": "Joined waitlist at position 3"
}
```

Each user can only have one active entry per (eventId, category). The `position` is auto-assigned as `MAX(position) + 1` for the show/category.

### GET /api/waitlist/my

List current user's waitlist entries. _(Auth required)_

```
Response 200: {
  "entries": [{ "id", "eventId", "category", "position", "status", "event": { "movie": { "title" }, "startTime" } }]
}
```

### GET /api/waitlist/event/:eventId

Get current user's waitlist status for a specific event. _(Auth required)_

```
Response 200: { "entry": { "id", "category", "position", "status" } | null }
```

### DELETE /api/waitlist/event/:eventId

Leave waitlist for an event (all categories). _(Auth required)_

```
Response 200: { "message": "Removed from waitlist" }
```

### DELETE /api/waitlist/:id

Cancel a specific waitlist entry by ID. _(Auth required)_

```
Response 200: { "message": "Waitlist entry cancelled" }
```

---

## Dashboard

### GET /api/dashboard/organizer

Organizer analytics dashboard. _(Organizer only)_

```
Response 200: {
  "totalMovies": number,
  "totalEvents": number,
  "totalBookings": number,
  "totalRevenue": "decimal",
  "occupancyRate": "decimal",
  "recentBookings": [...],
  "upcomingEvents": [...],
  "bookingsByMovie": [{ "movieId", "title", "count" }],
  "revenueByDay": [{ "date", "amount" }]
}
```

### GET /api/dashboard/admin

System-wide admin dashboard. _(Admin only)_

```
Response 200: {
  "totalUsers": number,
  "totalMovies": number,
  "totalBookings": number,
  "totalRevenue": "decimal",
  "usersByRole": { "CUSTOMER": number, "ORGANIZER": number, "ADMIN": number },
  "revenueByDay": [{ "date", "amount" }],
  "recentActivity": [...]
}
```

---

## Notifications

### GET /api/notifications

List notifications for the authenticated user. _(Auth required)_

```
Query: ?limit=number (default: 50), ?unread=true
Response 200: {
  "notifications": [
    {
      "id", "type": "BOOKING_CONFIRMED | WAITLIST_PROMOTED | ...",
      "title": "string",
      "message": "string",
      "readAt": "ISO 8601 | null",
      "createdAt": "ISO 8601",
      "bookingId": "uuid | null"
    }
  ],
  "total": number
}
```

### GET /api/notifications/unread-count

Get unread notification count. _(Auth required)_

```
Response 200: { "count": number }
```

### PATCH /api/notifications/read-all

Mark all notifications as read. _(Auth required)_

```
Response 200: { "message": "All notifications marked as read" }
```

### PATCH /api/notifications/:id/read

Mark a single notification as read. _(Auth required)_

```
Response 200: { "notification": { ... }, "message": "Marked as read" }
```

---

## Admin

### GET /api/admin/users

List all users. _(Admin only)_

```
Query: ?role=CUSTOMER|ORGANIZER|ADMIN, ?page=1, ?limit=20
Response 200: { "users": [...], "total": number }
```

### PATCH /api/admin/users/:id/role

Update user role. _(Admin only)_

```
Body: { "role": "CUSTOMER | ORGANIZER | ADMIN" }
Response 200: { "user": { ... } }
```

### DELETE /api/admin/users/:id

Delete a user. _(Admin only)_

```
Response 200: { "message": "User deleted" }
```

### GET /api/admin/bookings

List all bookings system-wide. _(Admin only)_

```
Query: ?status=CONFIRMED|CANCELLED|REFUNDED, ?page=1, ?limit=20
Response 200: { "bookings": [...], "total": number }
```

### GET /api/admin/audit-logs

View audit logs. _(Admin only)_

```
Query: ?action=string, ?userId=uuid, ?page=1, ?limit=50
Response 200: { "logs": [...], "total": number }
```

---

## Search

### GET /api/search

Full-text search across movies and events.

```
Query: ?q=string (required, min 2 chars)
Response 200: {
  "movies": [{ "id", "title", "description", "posterUrl", "language", "venue": { "name", "city" } }],
  "events": [{ "id", "startTime", "endTime", "movie": { "title" }, "venue": { "name" } }]
}
```

---

## Coupons

### GET /api/coupons

List all coupons. _(Admin only)_

### GET /api/coupons/:id

Get coupon by ID. _(Admin only)_

### POST /api/coupons

Create coupon. _(Admin only)_

```
Body: {
  "code": "string (unique)",
  "discountType": "PERCENTAGE | FIXED",
  "discountValue": "decimal",
  "maxUses": "number (optional)",
  "minBookingAmount": "decimal (optional)",
  "expiresAt": "ISO 8601 (optional)"
}
Response 201: { "id", "code", ... }
```

### PUT /api/coupons/:id

Update coupon. _(Admin only)_

### DELETE /api/coupons/:id

Delete coupon. _(Admin only)_

### POST /api/coupons/validate

Validate a coupon code before booking. _(Auth required)_

```
Body: { "code": "string", "amount": "decimal" }
Response 200: {
  "valid": true,
  "discount": { "type": "PERCENTAGE | FIXED", "value": "10.00" },
  "finalAmount": "40.00"
}
```

---

## Reviews

### GET /api/reviews/movie/:movieId

List reviews for a movie.

```
Query: ?page=1, ?limit=10
Response 200: {
  "reviews": [{ "id", "rating", "comment", "user": { "id", "name" }, "createdAt" }],
  "averageRating": "4.2",
  "total": number
}
```

### POST /api/reviews/movie/:movieId

Create a review. _(Auth required)_

```
Body: {
  "rating": "number (1-5)",
  "comment": "string (optional, max 1000 chars)"
}
Response 201: { "id", ... }
```

One review per user per movie.

### PUT /api/reviews/:id

Update a review. _(Auth required, owner only)_

### DELETE /api/reviews/:id

Delete a review. _(Auth required, owner only)_

---

## Scraper (Organizer)

### GET /api/organizer/movies

Get now-showing movies from external source. _(Auth optional)_

### GET /api/organizer/events

Get events list from external source. _(Auth optional)_

### GET /api/organizer/movie-details

Get detailed movie info from external source. _(Auth optional)_

### POST /api/organizer/refresh-cache

Refresh the scraper cache. _(Organizer only)_

### POST /api/organizer/import-scraper-movie

Import a movie from scraper data into the database. _(Organizer only)_

---

## Health

### GET /api/health

Health check endpoint.

```
Response 200: { "uptime": 1234.56, "message": "Ticket Booking API running" }
```
