import { FREE_CANCELLATION_HOURS } from "../bookings/rules.ts";
import { prisma } from "../db.ts";
import type { Dependencies } from "../dependencies.ts";
import { formatLari } from "../shop/details.ts";
import {
  type BookingForEmail,
  bookingForEmail,
  cancelledEmail,
  confirmationEmail,
  depositReturnedEmail,
  describeTime,
  rescheduledEmail,
} from "./emails.ts";

// Telling people what happened to a booking.
//
// Every function here is called after the change it reports has been saved,
// and none of them can fail: whatever goes wrong while sending is logged
// and swallowed. A mail server being down must never undo a booking, or
// turn a successful request into an error.

type Notifiers = Pick<Dependencies, "mailer" | "ownerAlerts">;

async function attempt(what: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error(`Could not send ${what}`, error);
  }
}

// Runs one notification for one booking, with the booking's details loaded.
async function notifyAbout(
  bookingId: string,
  what: string,
  send: (booking: BookingForEmail) => Promise<void>,
): Promise<void> {
  await attempt(`${what} for booking ${bookingId}`, async () => {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingForEmail,
    });
    await send(booking);
  });
}

// "Haircut with Luka Gelashvili, Monday 12 October at 11:00"
const summarise = (booking: BookingForEmail) =>
  `${booking.service.name} with ${booking.barber.user.name}, ${describeTime(booking.startsAt)}`;

const customerLine = (booking: BookingForEmail) =>
  `${booking.customer.name}${booking.customer.phone ? `, ${booking.customer.phone}` : ""}`;

export async function notifyBookingConfirmed(deps: Notifiers, bookingId: string): Promise<void> {
  await notifyAbout(bookingId, "the confirmation email", (booking) =>
    deps.mailer.send(confirmationEmail(booking, FREE_CANCELLATION_HOURS)),
  );
  await notifyAbout(bookingId, "the new booking alert", (booking) =>
    deps.ownerAlerts.send(
      `New booking: ${summarise(booking)}.\nCustomer: ${customerLine(booking)}.`,
    ),
  );
}

export async function notifyBookingRescheduled(
  deps: Notifiers,
  bookingId: string,
  previousStartsAt: Date,
): Promise<void> {
  await notifyAbout(bookingId, "the rescheduling email", (booking) =>
    deps.mailer.send(rescheduledEmail(booking, previousStartsAt)),
  );
}

const DEPOSIT_OUTCOMES: Record<string, (deposit: string) => string> = {
  REFUNDED: (deposit) => `The ${deposit} deposit was refunded.`,
  PAID: (deposit) => `The ${deposit} deposit was kept.`,
  REFUND_FAILED: (deposit) => `The ${deposit} refund FAILED and has to be made by hand.`,
  UNPAID: () => "No deposit had been paid.",
};

export async function notifyBookingCancelled(
  deps: Notifiers,
  bookingId: string,
  cancelledBy: "customer" | "shop",
): Promise<void> {
  await notifyAbout(bookingId, "the cancellation email", (booking) =>
    deps.mailer.send(cancelledEmail(booking, cancelledBy)),
  );
  await notifyAbout(bookingId, "the cancellation alert", (booking) => {
    const outcome = DEPOSIT_OUTCOMES[booking.paymentStatus]?.(formatLari(booking.depositCents));
    return deps.ownerAlerts.send(
      `Cancelled by the ${cancelledBy}: ${summarise(booking)}.\nCustomer: ${customerLine(booking)}.\n${outcome ?? ""}`,
    );
  });
}

export async function notifyDepositReturned(deps: Notifiers, bookingId: string): Promise<void> {
  await notifyAbout(bookingId, "the deposit-returned email", (booking) =>
    deps.mailer.send(depositReturnedEmail(booking)),
  );
}
