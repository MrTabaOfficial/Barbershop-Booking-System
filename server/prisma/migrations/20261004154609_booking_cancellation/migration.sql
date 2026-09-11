-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "cancelled_in_free_window" BOOLEAN;
