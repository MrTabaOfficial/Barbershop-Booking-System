import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import { daysBetween, shopTimeToUtc } from "../shop/time.ts";
import { BOOKING_STATUS_NAMES, MAX_OVERVIEW_DAYS } from "./schemas.ts";

type DayRow = { date: string; bookings: number; revenueCents: number };
type StatusRow = { status: string; count: number };
type ServiceRow = { serviceId: string; name: string; bookings: number };

const TOP_SERVICES = 5;

// The figures are counted in SQL because a "day" must be the shop's day (AT
// TIME ZONE gets that right, daylight saving included), generate_series
// returns an empty day as a zero, and only totals leave the database.
export async function getOverview(from: string, to: string) {
  if (daysBetween(from, to) >= MAX_OVERVIEW_DAYS) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is not valid", [
      { path: "to", message: `An overview covers at most ${MAX_OVERVIEW_DAYS} days` },
    ]);
  }

  const timeZone = env.shopTimeZone;
  const rangeStart = shopTimeToUtc(from, 0, timeZone);
  const rangeEnd = shopTimeToUtc(to, 24 * 60, timeZone);

  const [perDay, statusRows, topServices] = await Promise.all([
    // The ${...} values in these queries are sent as bound parameters, not
    // pasted into the SQL text.
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

  const byStatus = Object.fromEntries(
    BOOKING_STATUS_NAMES.map((name) => [
      name,
      statusRows.find((row) => row.status.toLowerCase() === name)?.count ?? 0,
    ]),
  ) as Record<(typeof BOOKING_STATUS_NAMES)[number], number>;

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
