-- Drop FK constraints that reference columns/tables being renamed
ALTER TABLE "Seat" DROP CONSTRAINT "Seat_showId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_showId_fkey";
ALTER TABLE "WaitlistEntry" DROP CONSTRAINT "WaitlistEntry_showId_fkey";
ALTER TABLE "Show" DROP CONSTRAINT "Show_eventId_fkey";

-- Rename enums
ALTER TYPE "EventStatus" RENAME TO "MovieStatus";
ALTER TYPE "ShowStatus" RENAME TO "EventStatus";

-- Rename tables
ALTER TABLE "Event" RENAME TO "Movie";
ALTER TABLE "Show" RENAME TO "Event";

-- Rename columns
ALTER TABLE "Seat" RENAME COLUMN "showId" TO "eventId";
ALTER TABLE "Booking" RENAME COLUMN "showId" TO "eventId";
ALTER TABLE "WaitlistEntry" RENAME COLUMN "showId" TO "eventId";
ALTER TABLE "Event" RENAME COLUMN "eventId" TO "movieId";

-- Rename indexes on Movie (was Event)
ALTER INDEX "Event_pkey" RENAME TO "Movie_pkey";
ALTER INDEX "Event_venueId_idx" RENAME TO "Movie_venueId_idx";
ALTER INDEX "Event_organizerId_idx" RENAME TO "Movie_organizerId_idx";
ALTER INDEX "Event_status_idx" RENAME TO "Movie_status_idx";
ALTER INDEX "Event_category_idx" RENAME TO "Movie_category_idx";
ALTER INDEX "Event_title_idx" RENAME TO "Movie_title_idx";

-- Rename indexes on Event (was Show)
ALTER INDEX "Show_pkey" RENAME TO "Event_pkey";
ALTER INDEX "Show_eventId_idx" RENAME TO "Event_movieId_idx";
ALTER INDEX "Show_startTime_idx" RENAME TO "Event_startTime_idx";
ALTER INDEX "Show_status_idx" RENAME TO "Event_status_idx";

-- Rename indexes on Seat
ALTER INDEX "Seat_showId_status_idx" RENAME TO "Seat_eventId_status_idx";
ALTER INDEX "Seat_showId_heldBy_idx" RENAME TO "Seat_eventId_heldBy_idx";
ALTER INDEX "Seat_showId_seatNumber_key" RENAME TO "Seat_eventId_seatNumber_key";

-- Rename index on Booking
ALTER INDEX "Booking_showId_idx" RENAME TO "Booking_eventId_idx";

-- Rename indexes on WaitlistEntry
ALTER INDEX "WaitlistEntry_showId_category_status_position_idx" RENAME TO "WaitlistEntry_eventId_category_status_position_idx";
ALTER INDEX "WaitlistEntry_showId_status_idx" RENAME TO "WaitlistEntry_eventId_status_idx";
ALTER INDEX "WaitlistEntry_userId_showId_category_key" RENAME TO "WaitlistEntry_userId_eventId_category_key";

-- Rename FK constraints on Movie (was Event)
ALTER TABLE "Movie" RENAME CONSTRAINT "Event_venueId_fkey" TO "Movie_venueId_fkey";
ALTER TABLE "Movie" RENAME CONSTRAINT "Event_organizerId_fkey" TO "Movie_organizerId_fkey";

-- Re-add FK constraints with new names
ALTER TABLE "Event" ADD CONSTRAINT "Event_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
