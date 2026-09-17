import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import { daysBetween, shopTimeToUtc } from "../shop/time.ts";
import { BOOKING_STATUS_NAMES, MAX_OVERVIEW_DAYS } from "./schemas.ts";

type DayRow = { date: string; bookings: number; revenueCents: number };
type StatusRow = { status: string; count: number };
type ServiceRow = { serviceId: string; name: string; bookings: number };

const TOP_SERVICES = 5;

// The numbers behind the admin's overview, for the shop dates `from` to
// `to`, both included.
//
// They are counted in SQL rather than in code, for three reasons:
// - a "day" must be the shop's day. A booking at 00:30 in the shop is still
//   the previous day in UTC, and PostgreSQL's AT TIME ZONE moves it to the
//   right date, daylight saving included;
// - generate_series lists every date in the range, so a day with nothing
//   booked comes back as a zero instead of being missing;
// - the database only sends back the totals, never the bookings.
//
// The ${...} values are sent as bound parameters, not pasted into the text.
export async function getOverview(from: string, to: string) {
  if (daysBetween(from, to) >= MAX_OVERVIEW_DAYS) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is not valid", [
      { path: "to", message: `An overview covers at most ${MAX_OVERVIEW_DAYS} days` },
    ]);
  }

  const timeZone = env.shopTimeZone;
  // The same range as instants, so each query can use the index on
  // starts_at before doing anything per row.
  const rangeStart = shopTimeToUtc(from, 0, timeZone);
  const rangeEnd = shopTimeToUtc(to, 24 * 60, timeZone);

  const [perDay, statusRows, topServices] = await Promise.all([
    // One row per date. "Bookings" are the ones that were neither
    // cancelled nor left unpaid until they expired; revenue counts only
    // the completed ones.
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char(day, 'YYYY-MM-DD') AS "date",
             (count(b.id) FILTER (WHERE b.status NOT IN ('CANCELLED', 'EXPIRED')))::int
               AS "bookings",
             coalesce(sum(b.price_cents) FILTER (WHERE b.status = 'COMPLETED'), 0)::int
               AS "revenueCents"
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS day
      LEFT JOIN bookings b
        ON (b.starts_at AT TIME ZONE ${timeZone})::date = day::date
       AND b.starts_at >= ${rangeStart}
       AND b.starts_at < ${rangeEnd}
      GROUP BY day
      ORDER BY day
    `,
    prisma.$queryRaw<StatusRow[]>`
      SELECT status::text AS "status", count(*)::int AS "count"
      FROM bookings
      WHERE starts_at >= ${rangeStart} AND starts_at < ${rangeEnd}
      GROUP BY status
    `,
    prisma.$queryRaw<ServiceRow[]>`
      SELECT s.id AS "serviceId", s.name AS "name", count(*)::int AS "bookings"
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.starts_at >= ${rangeStart} AND b.starts_at < ${rangeEnd}
        AND b.status NOT IN ('CANCELLED', 'EXPIRED')
      GROUP BY s.id, s.name
      ORDER BY "bookings" DESC, s.name ASC
      LIMIT ${TOP_SERVICES}
    `,
  ]);

  // Every status gets a number, including the ones with no bookings.
  const byStatus = Object.fromEntries(
    BOOKING_STATUS_NAMES.map((name) => [
      name,
      statusRows.find((row) => row.status.toLowerCase() === name)?.count ?? 0,
    ]),
  ) as Record<(typeof BOOKING_STATUS_NAMES)[number], number>;

  // Of the appointments that reached their time, how many did the customer
  // miss. Cancelled and upcoming bookings are in neither number, so they
  // can't dilute the rate. Null when nothing has reached its time yet.
  const attended = byStatus.completed + byStatus.no_show;
  const noShowRate = attended === 0 ? null : byStatus.no_show / attended;

  return {
    from,
    to,
    totals: {
      bookings: perDay.reduce((sum, day) => sum + day.bookings, 0),
      revenueCents: perDay.reduce((sum, day) => sum + day.revenueCents, 0),
    },
    perDay,
    byStatus,
    noShowRate,
    topServices,
  };
}
