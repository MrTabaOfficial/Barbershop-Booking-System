import { prisma } from "../db.ts";
import type { Dependencies } from "../dependencies.ts";
import { env } from "../env.ts";
import { bookingForEmail, reminderEmail } from "../notifications/emails.ts";
import { addDays, shopDateOf, shopMinutesOf, shopTimeToUtc } from "../shop/time.ts";

const SEND_FROM_MINUTE = 10 * 60;

// Each booking is claimed by stamping reminderSentAt before the email goes
// out, so overlapping runs can't both send, and a failed send clears the
// stamp for the next run.
export async function sendReminders(
  deps: Pick<Dependencies, "mailer">,
  now = new Date(),
): Promise<number> {
  const timeZone = env.shopTimeZone;
  if (shopMinutesOf(now, timeZone) < SEND_FROM_MINUTE) {
    return 0;
  }

  const today = shopDateOf(now, timeZone);
  const tomorrow = addDays(today, 1);
  const due = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startsAt: {
        gte: shopTimeToUtc(tomorrow, 0, timeZone),
        lt: shopTimeToUtc(tomorrow, 24 * 60, timeZone),
      },
      createdAt: { lt: shopTimeToUtc(today, 0, timeZone) },
    },
    include: bookingForEmail,
  });

  let sent = 0;
  for (const booking of due) {
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, status: "CONFIRMED", reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claim.count === 0) {
      continue;
    }
    try {
      await deps.mailer.send(reminderEmail(booking));
      sent += 1;
    } catch (error) {
      console.error(`Could not send the reminder for booking ${booking.id}`, error);
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: null } });
    }
  }
  return sent;
}
