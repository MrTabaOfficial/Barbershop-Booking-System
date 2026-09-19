import { isSlotTakenError } from "../bookings/errors.ts";
import { prisma } from "../db.ts";
import type { Dependencies } from "../dependencies.ts";
import type { PaymentStatus } from "../generated/prisma/client.ts";
import { notifyBookingConfirmed, notifyDepositReturned } from "../notifications/service.ts";
import type { PaymentProviders } from "./index.ts";
import type { PaymentEvent } from "./provider.ts";

// Every change here is an update that only matches while the row is in the
// expected state, which is what makes a repeated webhook harmless.

export async function handlePaymentEvent(deps: Dependencies, event: PaymentEvent): Promise<void> {
  if (event.type === "payment_succeeded") {
    await confirmPaidBooking(deps, event.sessionId, event.paymentId);
  } else if (event.type === "checkout_expired") {
    await prisma.booking.updateMany({
      where: { paymentSessionId: event.sessionId, status: "PENDING" },
      data: { status: "EXPIRED", holdExpiresAt: null },
    });
  }
}

async function confirmPaidBooking(
  deps: Dependencies,
  sessionId: string,
  paymentId: string,
): Promise<void> {
  const paid = { paymentStatus: "PAID", paymentId, holdExpiresAt: null } as const;

  const confirmed = await prisma.booking.updateMany({
    where: { paymentSessionId: sessionId, status: "PENDING" },
    data: { status: "CONFIRMED", ...paid },
  });
  const booking = await prisma.booking.findUnique({ where: { paymentSessionId: sessionId } });
  if (!booking) {
    return;
  }
  if (confirmed.count === 1) {
    await notifyBookingConfirmed(deps, booking.id);
    return;
  }
  if (booking.paymentStatus !== "UNPAID") {
    return;
  }

  if (booking.status === "EXPIRED") {
    try {
      const revived = await prisma.booking.updateMany({
        where: { id: booking.id, status: "EXPIRED" },
        data: { status: "CONFIRMED", ...paid },
      });
      if (revived.count === 1) {
        await notifyBookingConfirmed(deps, booking.id);
        return;
      }
    } catch (error) {
      if (!isSlotTakenError(error)) {
        throw error;
      }
    }
  }

  await prisma.booking.update({ where: { id: booking.id }, data: paid });
  await refundDeposit(deps.payments, { ...booking, paymentId });
  await notifyDepositReturned(deps, booking.id);
}

export async function expireUnpaidBookings(now = new Date()): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: { status: "PENDING", holdExpiresAt: { lte: now } },
    data: { status: "EXPIRED", holdExpiresAt: null },
  });
  return result.count;
}

type PaidBooking = {
  id: string;
  paymentId: string | null;
  paymentProvider: string | null;
};

// A refund that fails is logged and marked, never thrown, because the booking
// has already been cancelled and that must stand whatever the payment
// provider says.
export async function refundDeposit(
  payments: PaymentProviders,
  booking: PaidBooking,
): Promise<PaymentStatus> {
  let paymentStatus: PaymentStatus;
  try {
    // The money goes back through the provider that took it, which is not
    // necessarily the one taking new deposits today.
    const provider = payments.named(booking.paymentProvider);
    if (!provider) {
      throw new Error(`Payment provider "${booking.paymentProvider}" is not configured`);
    }
    if (!booking.paymentId) {
      throw new Error("The booking has no payment id to refund");
    }
    await provider.refund(booking.paymentId, `refund-${booking.id}`);
    paymentStatus = "REFUNDED";
  } catch (error) {
    console.error(`Refund failed for booking ${booking.id}`, error);
    paymentStatus = "REFUND_FAILED";
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus } });
  return paymentStatus;
}

export async function settleCancelledBooking(
  payments: PaymentProviders,
  booking: PaidBooking & { paymentStatus: PaymentStatus; paymentSessionId: string | null },
  refund: boolean,
): Promise<void> {
  if (booking.paymentStatus === "UNPAID") {
    const provider = payments.named(booking.paymentProvider);
    if (provider && booking.paymentSessionId) {
      await provider.expireCheckout(booking.paymentSessionId).catch((error: unknown) => {
        console.error(`Could not close the checkout of booking ${booking.id}`, error);
      });
    }
    return;
  }
  if (booking.paymentStatus === "PAID" && refund) {
    await refundDeposit(payments, booking);
  }
}
