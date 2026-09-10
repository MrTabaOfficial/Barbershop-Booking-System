-- Hand-written: Prisma's schema language can't express these constraints.

-- An empty or backwards time range would slip past the overlap check below.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_ends_after_start" CHECK ("ends_at" > "starts_at");

-- btree_gist lets a GiST index compare an ordinary column (barber_id) with "=".
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- No two bookings for the same barber may cover overlapping time, unless one
-- of them is cancelled. tstzrange includes the start and excludes the end, so
-- a booking ending at 10:30 doesn't collide with one starting at 10:30.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "barber_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  )
  WHERE ("status" <> 'CANCELLED');
