import { findAvailableSlots, getActiveService } from "../availability/service.ts";
import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import type { Dependencies } from "../dependencies.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import {
  notifyBookingCancelled,
  notifyBookingConfirmed,
  notifyBookingRescheduled,
} from "../notifications/service.ts";
import { settleCancelledBooking } from "../payments/service.ts";
import { formatShopDate, shopClockTimeOf, shopDateOf } from "../shop/time.ts";
import { isSlotTakenError } from "./errors.ts";
import { FREE_CANCELLATION_HOURS, PAYMENT_CURRENCY, PAYMENT_HOLD_MS } from "./rules.ts";
import type { CreateBookingInput } from "./schemas.ts";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

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

// Creates the booking and, when the service has a deposit, the checkout the
// customer pays it on. Until that payment arrives the booking is pending
// and holds its slot only for a limited time.
export async function createBooking(
  deps: Dependencies,
  customerId: string,
  input: CreateBookingInput,
): Promise<{ booking: BookingWithDetails; checkoutUrl: string | null }> {
  const service = await getActiveService(input.serviceId);
  await assertSlotIsAvailable({
    barberId: input.barberId,
    durationMinutes: service.durationMinutes,
    startsAt: input.startsAt,
  });

  const needsDeposit = service.depositCents > 0;
  const holdExpiresAt = new Date(Date.now() + PAYMENT_HOLD_MS);

  let booking: BookingWithDetails;
  try {
    booking = await prisma.booking.create({
      data: {
        customerId,
        barberId: input.barberId,
        serviceId: service.id,
        startsAt: input.startsAt,
        endsAt: new Date(input.startsAt.getTime() + service.durationMinutes * MINUTE_MS),
        priceCents: service.priceCents,
        depositCents: service.depositCents,
        // With nothing to pay there is nothing to wait for.
        status: needsDeposit ? "PENDING" : "CONFIRMED",
        holdExpiresAt: needsDeposit ? holdExpiresAt : null,
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

  if (!needsDeposit) {
    await notifyBookingConfirmed(deps, booking.id);
    return { booking, checkoutUrl: null };
  }

  // The slot is held first and the checkout created second, so there is
  // never a payable checkout for a slot that isn't held.
  try {
    const customer = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    const when = `${formatShopDate(shopDateOf(booking.startsAt, env.shopTimeZone))} at ${shopClockTimeOf(booking.startsAt, env.shopTimeZone)}`;
    const provider = deps.payments.active;
    const checkout = await provider.createCheckout({
      bookingId: booking.id,
      amountCents: booking.depositCents,
      currency: PAYMENT_CURRENCY,
      description: `Deposit for ${service.name} with ${booking.barber.user.name}, ${when}`,
      customerEmail: customer.email,
      expiresAt: holdExpiresAt,
      // The website shows the outcome on the customer's bookings page.
      successUrl: `${env.appUrl}/bookings?paid=${booking.id}`,
      cancelUrl: `${env.appUrl}/bookings?unpaid=${booking.id}`,
    });
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentSessionId: checkout.sessionId,
        paymentUrl: checkout.url,
        // Remembered so that a refund goes back through the same provider.
        paymentProvider: provider.name,
      },
      include: bookingDetails,
    });
    return { booking, checkoutUrl: checkout.url };
  } catch (error) {
    // Without a way to pay, the booking can never be confirmed. Release
    // its slot now rather than leave it blocked for half an hour.
    console.error(`Could not start the deposit payment for booking ${booking.id}`, error);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "EXPIRED", holdExpiresAt: null },
    });
    throw new AppError(
      502,
      "PAYMENT_UNAVAILABLE",
      "We couldn't start the payment, so nothing was booked. Please try again in a moment.",
    );
  }
}

export async function listBookings(customerId: string) {
  const bookings = await prisma.booking.findMany({
    // A checkout the customer abandoned isn't a booking they need to see.
    where: { customerId, status: { not: "EXPIRED" } },
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

function describeStatus(status: string): string {
  return status.toLowerCase().replace("_", " ");
}

function getBookingWithDetails(bookingId: string): Promise<BookingWithDetails> {
  return prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: bookingDetails,
  });
}

// A customer may cancel a booking that is pending or confirmed and hasn't
// started. What happens to the deposit depends on how early they do it.
export async function cancelBooking(
  deps: Dependencies,
  customerId: string,
  bookingId: string,
): Promise<BookingWithDetails> {
  const booking = await getOwnBooking(customerId, bookingId);
  const now = new Date();

  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new AppError(
      409,
      "BOOKING_NOT_ACTIVE",
      `This booking is ${describeStatus(booking.status)} and can't be cancelled`,
    );
  }
  if (booking.startsAt <= now) {
    throw new AppError(
      409,
      "BOOKING_ALREADY_STARTED",
      "This booking has already started and can't be cancelled",
    );
  }

  const hoursUntilStart = (booking.startsAt.getTime() - now.getTime()) / HOUR_MS;
  const inFreeWindow = hoursUntilStart >= FREE_CANCELLATION_HOURS;

  // The status and start time are repeated in the condition so that this
  // only succeeds if the booking is still as it was when it was checked.
  // A second cancel, a reschedule or a payment that slipped in between
  // gets count 0.
  const result = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status, startsAt: booking.startsAt },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledInFreeWindow: inFreeWindow,
      holdExpiresAt: null,
    },
  });
  if (result.count === 0) {
    throw bookingChanged();
  }

  // The money is dealt with after the cancellation is saved. If the refund
  // fails the booking is still cancelled, and the failure is recorded.
  await settleCancelledBooking(deps.payments, booking, inFreeWindow);

  // A booking that was never confirmed was never announced to anyone, so
  // its cancellation isn't either.
  if (booking.status === "CONFIRMED") {
    await notifyBookingCancelled(deps, booking.id, "customer");
  }

  return getBookingWithDetails(booking.id);
}

export async function rescheduleBooking(
  deps: Dependencies,
  customerId: string,
  bookingId: string,
  startsAt: Date,
): Promise<BookingWithDetails> {
  const booking = await getOwnBooking(customerId, bookingId);
  const now = new Date();

  if (booking.status !== "CONFIRMED") {
    throw new AppError(
      409,
      "BOOKING_NOT_ACTIVE",
      booking.status === "PENDING"
        ? "Pay the deposit first: a booking can be moved once it is confirmed"
        : `This booking is ${describeStatus(booking.status)} and can't be moved`,
    );
  }
  // The same limit as free cancellation. Without it, a customer too late to
  // cancel for free could move the booking a month ahead and cancel that.
  if (booking.startsAt.getTime() - now.getTime() < FREE_CANCELLATION_HOURS * HOUR_MS) {
    throw new AppError(
      409,
      "TOO_LATE_TO_RESCHEDULE",
      `A booking can be moved until ${FREE_CANCELLATION_HOURS} hours before it starts`,
    );
  }

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

  await notifyBookingRescheduled(deps, booking.id, booking.startsAt);

  return getBookingWithDetails(booking.id);
}
