import { isSlotTakenError } from "../bookings/errors.ts";
import { prisma } from "../db.ts";
import type { PaymentStatus } from "../generated/prisma/client.ts";
import type { PaymentEvent, PaymentProvider } from "./provider.ts";

// What moves a booking because of money: a payment arriving, a hold running
// out, a refund. Every change here is written as "update the row if it is
// still in the state I expect", which is what makes a repeated webhook
// harmless: the second time, nothing matches and nothing changes.

export async function handlePaymentEvent(
  payments: PaymentProvider,
  event: PaymentEvent,
): Promise<void> {
  if (event.type === "payment_succeeded") {
    await confirmPaidBooking(payments, event.sessionId, event.paymentId);
  } else if (event.type === "checkout_expired") {
    await prisma.booking.updateMany({
      where: { paymentSessionId: event.sessionId, status: "PENDING" },
      data: { status: "EXPIRED", holdExpiresAt: null },
    });
  }
}

async function confirmPaidBooking(
  payments: PaymentProvider,
  sessionId: string,
  paymentId: string,
): Promise<void> {
  const paid = { paymentStatus: "PAID", paymentId, holdExpiresAt: null } as const;

  // The normal case: the booking was waiting for exactly this.
  const confirmed = await prisma.booking.updateMany({
    where: { paymentSessionId: sessionId, status: "PENDING" },
    data: { status: "CONFIRMED", ...paid },
  });
  if (confirmed.count === 1) {
    return;
  }

  const booking = await prisma.booking.findUnique({ where: { paymentSessionId: sessionId } });
  if (!booking || booking.paymentStatus !== "UNPAID") {
    // A session this database doesn't know, or an event already handled.
    return;
  }

  // The money arrived for a booking that is no longer pending: its hold ran
  // out a moment before the customer paid, or they cancelled it in another
  // tab. If it merely expired and nobody has taken the slot since, honour it.
  if (booking.status === "EXPIRED") {
    try {
      const revived = await prisma.booking.updateMany({
        where: { id: booking.id, status: "EXPIRED" },
        data: { status: "CONFIRMED", ...paid },
      });
      if (revived.count === 1) {
        return;
      }
    } catch (error) {
      // The overlap constraint refused: the slot belongs to someone else now.
      if (!isSlotTakenError(error)) {
        throw error;
      }
    }
  }

  // It can't be honoured, so record the payment and give the money back.
  await prisma.booking.update({ where: { id: booking.id }, data: paid });
  await refundDeposit(payments, { id: booking.id, paymentId });
}

// Marks every pending booking whose unpaid hold has run out as expired,
// which frees its slot. Safe to call as often as anyone likes.
export async function expireUnpaidBookings(now = new Date()): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: { status: "PENDING", holdExpiresAt: { lte: now } },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
  return result.count;
}

// Refunds a paid deposit and records how that went. A refund that fails
// is logged and marked, never thrown: by this point the booking has already
// been cancelled, and that must stand whatever the payment provider says.
export async function refundDeposit(
  payments: PaymentProvider,
  booking: { id: string; paymentId: string | null },
): Promise<PaymentStatus> {
  let paymentStatus: PaymentStatus;
  try {
    if (!booking.paymentId) {
      throw new Error("The booking has no payment id to refund");
    }
    // The key makes a retry safe: the provider refunds a given booking once.
    await payments.refund(booking.paymentId, `refund-${booking.id}`);
    paymentStatus = "REFUNDED";
  } catch (error) {
    console.error(`Refund failed for booking ${booking.id}`, error);
    paymentStatus = "REFUND_FAILED";
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus } });
  return paymentStatus;
}

// What happens to the money once a booking has been cancelled.
export async function settleCancelledBooking(
  payments: PaymentProvider,
  booking: {
    id: string;
    paymentStatus: PaymentStatus;
    paymentSessionId: string | null;
    paymentId: string | null;
  },
  refund: boolean,
): Promise<void> {
  if (booking.paymentStatus === "UNPAID") {
    // The customer may still have the checkout page open. Close it, so they
    // can't pay for a booking that no longer exists. If this fails, a late
    // payment is refunded by confirmPaidBooking above.
    if (booking.paymentSessionId) {
      await payments.expireCheckout(booking.paymentSessionId).catch((error: unknown) => {
        console.error(`Could not close the checkout of booking ${booking.id}`, error);
      });
    }
    return;
  }
  if (booking.paymentStatus === "PAID" && refund) {
    await refundDeposit(payments, booking);
  }
}
