# Database Schema

**ORM:** Prisma 7.8.0  
**Database:** PostgreSQL  
**Schema file:** `backend/prisma/schema.prisma`

---

## User

Core user account with role-based access control.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| name | String | |
| email | String | Unique |
| password | String | bcryptjs hashed |
| role | Enum: CUSTOMER, ORGANIZER, ADMIN | Default: CUSTOMER |
| city | String? | User's city for recommendations |
| phone | String? | |
| refreshToken | String? | Current valid refresh token |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations:**
- `movies` → Movie (as organizer)
- `bookings` → Booking
- `notifications` → Notification
- `waitlistEntries` → WaitlistEntry
- `sessions` → UserSession

---

## Venue

Physical venue with configurable seat layout.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| name | String | |
| address | String | |
| city | String | |
| totalRows | Int | Default: 10 |
| seatsPerRow | Int | Default: 10 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Seat layout:** `totalRows × seatsPerRow` seats are auto-generated when creating events.

**Relations:**
- `movies` → Movie

---

## Movie

A film/show that can be scheduled as events.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| title | String | |
| description | String? | |
| posterUrl | String? | URL to poster image |
| language | String? | |
| category | String | Default: "General" |
| status | Enum: PUBLISHED, DELETED | Default: PUBLISHED |
| venueId | String (UUID) | FK → Venue |
| organizerId | String (UUID) | FK → User |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations:**
- `venue` → Venue
- `organizer` → User
- `events` → Event

---

## Event

A scheduled screening of a movie at a specific time.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| movieId | String (UUID) | FK → Movie |
| startTime | DateTime (TZ) | |
| endTime | DateTime (TZ) | |
| status | Enum: SCHEDULED, ACTIVE, COMPLETED, CANCELLED | Default: SCHEDULED |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations:**
- `movie` → Movie
- `seats` → Seat (auto-generated from venue layout on create)
- `bookings` → Booking
- `waitlistEntries` → WaitlistEntry

---

## Seat

Individual seat within an event. Seats are auto-generated when an event is created.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| eventId | String (UUID) | FK → Event |
| seatNumber | String | e.g. "A-1", "B-12" |
| row | Int | Row number (1-based) |
| col | Int | Column number (1-based) |
| category | Enum: PREMIUM, STANDARD, ECONOMY | PREMIUM = rows 1-3, STANDARD = rows 4-6, ECONOMY = rows 7+ |
| price | Decimal | Configurable per-category; defaults: PREMIUM=500, STANDARD=300, ECONOMY=180 |
| status | Enum: AVAILABLE, HELD, BOOKED | Default: AVAILABLE |
| version | Int | Optimistic locking for concurrency |
| heldByUserId | String (UUID)? | FK → User (who currently holds this seat) |
| heldAt | DateTime? | When the hold started (for TTL expiry) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Concurrency:** `version` field is used for optimistic locking. Updates require matching version to prevent lost updates.

**Hold TTL:** Seats with `HELD` status and `heldAt < now - SEAT_HOLD_TTL_MINUTES` are released by periodic cleanup (BullMQ worker + cron fallback).

**Relations:**
- `event` → Event
- `bookingSeats` → BookingSeat
- `heldByUser` → User

---

## Booking

A confirmed ticket purchase.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String (UUID) | FK → User |
| eventId | String (UUID) | FK → Event |
| status | Enum: PENDING, CONFIRMED, CANCELLED, REFUNDED | Default: PENDING |
| totalAmount | Decimal | Sum of seat prices |
| ticketToken | String | HMAC-SHA256 signed QR token |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**QR Token:** Generated as `hmac(bookingId + userId + secret)`, encoded in QR image, emailed on confirmation.

**Relations:**
- `user` → User
- `event` → Event
- `bookingSeats` → BookingSeat
- `payment` → Payment (one-to-one)
- `ticketVerifications` → TicketVerification

---

## BookingSeat

Join table linking bookings to their specific seats.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String (UUID) | FK → Booking |
| seatId | String (UUID) | FK → Seat (unique per booking) |
| price | Decimal | Price at time of booking |

**Relations:**
- `booking` → Booking
- `seat` → Seat

---

## Payment

Payment record for a booking.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String (UUID) | FK → Booking (unique) |
| amount | Decimal | |
| status | Enum: PENDING, COMPLETED, FAILED, REFUNDED | Default: PENDING |
| method | String? | Payment method |
| transactionId | String? | External payment reference |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations:**
- `booking` → Booking

---

## WaitlistEntry

Queue for customers waiting for seats in a sold-out category.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String (UUID) | FK → User |
| eventId | String (UUID) | FK → Event |
| category | Enum: PREMIUM, STANDARD, ECONOMY | |
| status | Enum: WAITING, PROMOTED, EXPIRED, CANCELLED | Default: WAITING |
| position | Int | Position in queue (per category) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Flow:** WAITING → PROMOTED (seat offered) → EXPIRED (offer timed out) or CANCELLED (user left).

When a booking is cancelled, the next WAITING entry per category is promoted: status → PROMOTED, seat held, notification sent, offer expiry scheduled.

**Relations:**
- `user` → User
- `event` → Event

---

## Notification

In-app notification for users.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String (UUID) | FK → User |
| type | String | e.g. BOOKING_CONFIRMED, SEAT_RELEASED, WAITLIST_PROMOTED, BOOKING_CANCELLED |
| message | String | |
| read | Boolean | Default: false |
| createdAt | DateTime | |

**Relations:**
- `user` → User

---

## EmailLog

Audit trail for all sent emails.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| to | String | Recipient email |
| subject | String | |
| status | Enum: SENT, FAILED | |
| error | String? | Error message if failed |
| createdAt | DateTime | |

---

## AuditLog

Security and operational audit trail.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String (UUID)? | FK → User (nullable for system actions) |
| action | String | e.g. BOOKING_CREATED, SEAT_HELD, LOGIN |
| entity | String | Affected entity type |
| entityId | String? | Affected entity ID |
| metadata | JSON? | Additional context |
| ipAddress | String? | |
| createdAt | DateTime | |

---

## UserSession

Active user sessions for refresh token rotation.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| userId | String (UUID) | FK → User |
| refreshToken | String | Hashed refresh token |
| userAgent | String? | |
| ipAddress | String? | |
| expiresAt | DateTime | |
| createdAt | DateTime | |

---

## TicketVerification

Log of QR ticket verifications.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String (UUID) | FK → Booking |
| verifiedById | String (UUID) | FK → User (organizer/admin) |
| verifiedAt | DateTime | |

---

## ScraperCache

Cache for BookMyShow API responses.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| city | String | Lowercase city slug |
| type | String | `movies`, `events`, or `movie-details:EVENTCODE` |
| data | JSON | Cached API response |
| expiresAt | DateTime | Cache expiry |

**Index:** Compound unique on `(city, type)`.

---

## IdempotencyKey

Prevents duplicate booking requests.

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| key | String | Unique idempotency key |
| response | JSON | Cached response to return on replay |
| expiresAt | DateTime | Auto-expires after TTL |

---

## Enum Reference

| Enum | Values |
|------|--------|
| UserRole | CUSTOMER, ORGANIZER, ADMIN |
| MovieStatus | PUBLISHED, DELETED |
| EventStatus | SCHEDULED, ACTIVE, COMPLETED, CANCELLED |
| SeatStatus | AVAILABLE, HELD, BOOKED |
| SeatCategory | PREMIUM, STANDARD, ECONOMY |
| BookingStatus | PENDING, CONFIRMED, CANCELLED, REFUNDED |
| PaymentStatus | PENDING, COMPLETED, FAILED, REFUNDED |
| WaitlistStatus | WAITING, PROMOTED, EXPIRED, CANCELLED |
| EmailStatus | SENT, FAILED |

---

## Relationships Summary

```
User 1─N Movie (as organizer)
User 1─N Booking
User 1─N Notification
User 1─N WaitlistEntry
User 1─N UserSession
User 1─N AuditLog

Venue 1─N Movie
Movie 1─N Event
Movie N─1 Venue, User (organizer)

Event 1─N Seat
Event 1─N Booking
Event 1─N WaitlistEntry

Seat 1─1 BookingSeat (per booking)
Seat N─1 Event, User (heldBy)

Booking 1─N BookingSeat
Booking 1─1 Payment
Booking 1─N TicketVerification
Booking N─1 User, Event
```
