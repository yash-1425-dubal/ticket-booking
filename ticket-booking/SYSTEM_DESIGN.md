# Ticket Booking System — System Design

## 1. Seat Hold / TTL Mechanism

When a user selects seats and requests a hold, the backend does two things atomically:

1. **Database lock**: Each `Seat` row carries a `version` integer (optimistic lock). The hold update uses `version: { increment: 1 }` in Prisma, which produces `UPDATE seats SET status='HELD', version=version+1 WHERE id=? AND version=?`. If two requests arrive for the same seat, only the first succeeds — the second sees a stale version and updates zero rows.

2. **Redis TTL**: Each held seat gets a Redis key `seat:hold:<seatId>` with `SET NX PX 600000` (10-minute TTL). Both the database transaction and the Redis write must succeed for the hold to be valid. The Redis key serves as a fast in-memory check before touching the database.

A BullMQ recurring job scans for expired holds every 30 seconds (`seat-cleanup` queue). It queries seats where `status = 'HELD'` and `heldAt < NOW() - INTERVAL '10 minutes'`, releases them back to `AVAILABLE`, and clears the Redis keys. On release, a `seatReleased` Socket.IO event is broadcast so all connected clients see the seat become available in real time.

The frontend runs a local countdown from the `expiresAt` timestamp returned by the hold endpoint. When the counter hits zero, it clears the selected/hold state without waiting for the server — the user sees immediate feedback, and the server-side cleanup confirms the release asynchronously.

## 2. Concurrency Prevention

Concurrency is addressed at three levels:

**Database transactions**: All seat-state mutations run inside Prisma `$transaction`. For bookings, the transaction reads all requested seats, verifies each is `HELD` and `heldBy` matches the current user, then updates them to `BOOKED`. If any seat fails validation, the entire transaction rolls back — no partial bookings.

**Optimistic locking via version column**: Every `Seat` update increments `version`. This prevents lost updates when two requests race. The `WHERE version=?` clause means the second writer updates zero rows; the application code can detect this and reject the request.

**Redis distributed locks**: Before processing a hold or booking, the system acquires a Redis lock scoped to `lock:seat:<seatId>` using `SET NX PX 2000`. This serialises concurrent requests at the application level even across multiple server instances. The short 2-second TTL prevents prolonged blocking if a worker crashes while holding the lock.

**Idempotency**: Booking creation accepts an `idempotencyKey` (generated on the client as a UUID). If a duplicate key arrives, the system returns the existing booking rather than creating a duplicate payment or seat assignment. This is safe against network retries and double-clicks.

## 3. Waitlist Auto-Assignment Flow

When a seat becomes available (cancellation or expiry), the system calls `promoteWaitlist(showId, seatId)`:

1. Reads the released seat's `category` (e.g., PREMIUM).
2. Queries the waitlist for the first `WAITING` entry matching `(showId, category)`, ordered by `position` ascending.
3. Updates the waitlist entry to `PROMOTED`.
4. Creates an in-app `Notification` and enqueues an email job with a "Book Now" link.
5. Places a **temporary hold** on the seat for the promoted user (`status = 'HELD'`, `heldBy = userId`, `heldAt = now`).
6. Enqueues a delayed BullMQ job (`offer-expiry`) with delay = `WAITLIST_OFFER_TTL_MINUTES` (default 15).
7. Broadcasts a `waitlistPromoted` Socket.IO event to `show:<showId>`.

The FIFO order is maintained by the `position` column — each join assigns `MAX(position) + 1` for the given show/category, and promotion picks `MIN(position)`.

## 4. Time-Limited Offer Handling

Once promoted, the user has a configurable window (`WAITLIST_OFFER_TTL_MINUTES`, default 15) to book. The delayed BullMQ job `offer-expiry` fires after this period:

1. **Validates**: Checks that the seat is still `HELD` by the promoted user. If not (user already booked or the offer was manually released), the job is a no-op.
2. **Releases**: Updates the seat to `AVAILABLE`, clears `heldBy`/`heldAt`, and broadcasts `seatReleased`.
3. **Notifies**: Creates a `WAITLIST_EXPIRED` notification for the user.
4. **Cascades**: Calls `promoteWaitlist` again for the same seat, awarding it to the next person in line.

This ensures that if the promoted user doesn't act within the window, the opportunity passes to the next waiting user with zero manual intervention. The cascade continues until either a user books the seat or the waitlist is exhausted.

The offer TTL is deliberately short (15 minutes) to minimise the gap between promotion and resolution. The frontend displays a countdown timer on the booking page, and the "Hold expiry" banner turns red below 2 minutes for urgency.
