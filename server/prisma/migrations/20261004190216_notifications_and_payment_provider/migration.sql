-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "payment_provider" TEXT,
ADD COLUMN     "reminder_sent_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "date" DATE NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("date")
);

