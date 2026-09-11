import { findAvailableSlots, getActiveService } from "../availability/service.ts";
import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import { type BookingStatus, Prisma } from "../generated/prisma/client.ts";
import { shopDateOf } from "../shop/time.ts";
import type { CreateBookingInput } from "./schemas.ts";

export const FREE_CANCELLATION_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// A booking can only be cancelled or moved while it is in one of these.
const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

const bookingDetails = {
  service: true,
  barber: { include: { user: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithDetails = Prisma.BookingGetPayload<{
  include: typeof bookingDetails;
}>;

function slotUnavailable(): AppError {
  return new AppError(
    409,
    "SLOT_UNAVAILABLE",
    "That time is not available. Please pick another slot.",
  );
}

function bookingChanged(): AppError {
  return new AppError(
    409,
    "BOOKING_CHANGED",
    "This booking was changed a moment ago. Reload it and try again.",
  );
}

// True when PostgreSQL refused a write because another booking for that
// barber covers the time. It reports this in one of two ways:
// - a violation of the bookings_no_overlap exclusion constraint, when the
//   other booking was already saved;
// - a deadlock (Prisma code P2034), when both were being saved at the same
//   instant. Each write waits to see if the other commits, and PostgreSQL
//   breaks the tie by aborting one of them. The other one goes through.
function isSlotTakenError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  return error.code === "P2034" || error.message.includes("bookings_no_overlap");
}

// The availability rules, applied to one requested start time. The slot
// list is the single source of truth: if the time isn't in it, it can't
// be booked, whatever the reason.
async function assertSlotIsAvailable(request: {
  barberId: string;
  durationMinutes: number;
  startsAt: Date;
  ignoreBookingId?: string;
}): Promise<void> {
  const slots = await findAvailableSlots({
    barberId: request.barberId,
    shopDate: shopDateOf(request.startsAt, env.shopTimeZone),
    durationMinutes: request.durationMinutes,
    ignoreBookingId: request.ignoreBookingId,
  });
  const requested = request.startsAt.getTime();
  if (!slots.some((slot) => slot.getTime() === requested)) {
    throw slotUnavailable();
  }
}

export async function createBooking(
  customerId: string,
  input: CreateBookingInput,
): Promise<BookingWithDetails> {
  const service = await getActiveService(input.serviceId);
  await assertSlotIsAvailable({
    barberId: input.barberId,
    durationMinutes: service.durationMinutes,
    startsAt: input.startsAt,
  });

  try {
    return await prisma.booking.create({
      data: {
        customerId,
        barberId: input.barberId,
        serviceId: service.id,
        startsAt: input.startsAt,
        endsAt: new Date(input.startsAt.getTime() + service.durationMinutes * MINUTE_MS),
        priceCents: service.priceCents,
        depositCents: service.depositCents,
      },
      include: bookingDetails,
    });
  } catch (error) {
    // Two requests can both pass the check above before either has saved.
    // The database then lets exactly one of them in.
    if (isSlotTakenError(error)) {
      throw slotUnavailable();
    }
    throw error;
  }
}

export async function listBookings(customerId: string) {
  const bookings = await prisma.booking.findMany({
    where: { customerId },
    include: bookingDetails,
    orderBy: { startsAt: "asc" },
  });
  const now = new Date();
  return {
    // Soonest first.
    upcoming: bookings.filter((booking) => booking.startsAt > now),
    // Most recent first.
    past: bookings.filter((booking) => booking.startsAt <= now).reverse(),
  };
}

// Someone else's booking gets the same answer as one that doesn't exist.
async function getOwnBooking(customerId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
  });
  if (!booking) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }
  return booking;
}

function assertCanStillChange(booking: { status: BookingStatus; startsAt: Date }, now: Date) {
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    throw new AppError(
      409,
      "BOOKING_NOT_ACTIVE",
      `This booking is ${booking.status.toLowerCase().replace("_", " ")} and can't be changed`,
    );
  }
  if (booking.startsAt <= now) {
    throw new AppError(
      409,
      "BOOKING_ALREADY_STARTED",
      "This booking has already started and can't be changed",
    );
  }
}

function getBookingWithDetails(bookingId: string): Promise<BookingWithDetails> {
  return prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: bookingDetails,
  });
}

export async function cancelBooking(
  customerId: string,
  bookingId: string,
): Promise<BookingWithDetails> {
  const booking = await getOwnBooking(customerId, bookingId);
  const now = new Date();
  assertCanStillChange(booking, now);

  const hoursUntilStart = (booking.startsAt.getTime() - now.getTime()) / HOUR_MS;

  // The status and start time are repeated in the condition so that this
  // only succeeds if the booking is still as it was when it was checked.
  // A second cancel, or a reschedule that slipped in between, gets count 0.
  const result = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status, startsAt: booking.startsAt },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledInFreeWindow: hoursUntilStart >= FREE_CANCELLATION_HOURS,
    },
  });
  if (result.count === 0) {
    throw bookingChanged();
  }

  return getBookingWithDetails(booking.id);
}

export async function rescheduleBooking(
  customerId: string,
  bookingId: string,
  startsAt: Date,
): Promise<BookingWithDetails> {
  const booking = await getOwnBooking(customerId, bookingId);
  assertCanStillChange(booking, new Date());

  // The booking keeps its original length even if the service's duration
  // has been edited since.
  const durationMs = booking.endsAt.getTime() - booking.startsAt.getTime();
  await assertSlotIsAvailable({
    barberId: booking.barberId,
    durationMinutes: durationMs / MINUTE_MS,
    startsAt,
    ignoreBookingId: booking.id,
  });

  try {
    // Moving the booking is a single UPDATE, so it either gets the new time
    // or keeps the old one. There is no moment where it holds neither.
    const result = await prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status, startsAt: booking.startsAt },
      data: { startsAt, endsAt: new Date(startsAt.getTime() + durationMs) },
    });
    if (result.count === 0) {
      throw bookingChanged();
    }
  } catch (error) {
    if (isSlotTakenError(error)) {
      throw slotUnavailable();
    }
    throw error;
  }

  return getBookingWithDetails(booking.id);
}
