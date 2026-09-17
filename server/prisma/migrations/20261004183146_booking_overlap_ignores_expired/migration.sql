-- Hand-written: Prisma's schema language can't express exclusion constraints.
--
-- A booking whose deposit wasn't paid in time is EXPIRED. Like a cancelled
-- booking it no longer holds its slot, so the overlap rule must skip it too.
-- This is its own migration because PostgreSQL doesn't allow a new enum
-- value to be used in the same transaction that adds it.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_no_overlap";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "barber_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  )
  WHERE ("status" NOT IN ('CANCELLED', 'EXPIRED'));
