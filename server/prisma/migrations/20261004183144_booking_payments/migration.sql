-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('UNPAID', 'PAID', 'REFUNDED', 'REFUND_FAILED');

-- AlterEnum
ALTER TYPE "booking_status" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "hold_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "payment_id" TEXT,
ADD COLUMN     "payment_session_id" TEXT,
ADD COLUMN     "payment_status" "payment_status" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "payment_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_payment_session_id_key" ON "bookings"("payment_session_id");

