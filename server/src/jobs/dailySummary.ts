import { getOverview } from "../admin/overview.ts";
import { isUniqueViolation, prisma } from "../db.ts";
import type { Dependencies } from "../dependencies.ts";
import { env } from "../env.ts";
import { formatLari, shopDetails } from "../shop/details.ts";
import {
  addDays,
  formatShopDate,
  shopDateOf,
  shopMinutesOf,
  shopTimeToUtc,
  toDateColumn,
  weekdayOf,
} from "../shop/time.ts";

async function closingMinuteOn(shopDate: string): Promise<number | null> {
  const latest = await prisma.workingHours.aggregate({
    where: { weekday: weekdayOf(shopDate), barber: { isActive: true } },
    _max: { endMinute: true },
  });
  return latest._max.endMinute;
}

export async function sendDailySummary(
  deps: Pick<Dependencies, "ownerAlerts">,
  now = new Date(),
): Promise<boolean> {
  const timeZone = env.shopTimeZone;
  const today = shopDateOf(now, timeZone);

  const closingMinute = await closingMinuteOn(today);
  if (closingMinute === null || shopMinutesOf(now, timeZone) < closingMinute) {
    return false;
  }

  const date = toDateColumn(today);
  try {
    await prisma.dailySummary.create({ data: { date } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }

  try {
    const tomorrow = addDays(today, 1);
    const [overview, cancelledToday, bookedForTomorrow] = await Promise.all([
      getOverview(today, today),
      prisma.booking.count({
        where: {
          cancelledAt: {
            gte: shopTimeToUtc(today, 0, timeZone),
            lt: shopTimeToUtc(today, 24 * 60, timeZone),
          },
        },
      }),
      prisma.booking.count({
        where: {
          status: "CONFIRMED",
          startsAt: {
            gte: shopTimeToUtc(tomorrow, 0, timeZone),
            lt: shopTimeToUtc(tomorrow, 24 * 60, timeZone),
          },
        },
      }),
    ]);
    const { byStatus, totals } = overview;

    const lines = [
      `${shopDetails.name}, ${formatShopDate(today)}`,
      `Completed: ${byStatus.completed} (${formatLari(totals.revenueCents)})`,
      `No-shows: ${byStatus.no_show}`,
      `Not marked yet: ${byStatus.confirmed}`,
      `Cancellations made today: ${cancelledToday}`,
      `Booked for tomorrow: ${bookedForTomorrow}`,
    ];
    await deps.ownerAlerts.send(lines.join("\n"));
    return true;
  } catch (error) {
    console.error(`Could not send the daily summary for ${today}`, error);
    await prisma.dailySummary.delete({ where: { date } });
    return false;
  }
}
