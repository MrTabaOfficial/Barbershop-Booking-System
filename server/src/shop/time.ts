// Conversions between the shop's clock and UTC instants.
//
// A "shop date" is a calendar date in the shop's time zone, written
// YYYY-MM-DD. A plain `Date` is always an exact instant.
//
// Temporal does the time zone arithmetic. Its default handling of
// daylight saving is what we want: a clock time that is skipped moves to
// the first moment after the gap, and one that happens twice means the
// first occurrence.

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// The instant at which the shop's clock shows the given time on the given
// date. 1440 minutes is midnight at the end of that date.
export function shopTimeToUtc(
  shopDate: string,
  minutesAfterMidnight: number,
  timeZone: string,
): Date {
  const zoned = Temporal.PlainDate.from(shopDate)
    .toPlainDateTime()
    .add({ minutes: minutesAfterMidnight })
    .toZonedDateTime(timeZone);
  return new Date(zoned.epochMilliseconds);
}

function toShopClock(instant: Date, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(
    timeZone,
  );
}

export function shopDateOf(instant: Date, timeZone: string): string {
  return toShopClock(instant, timeZone).toPlainDate().toString();
}

// "HH:MM" on the shop's clock.
export function shopClockTimeOf(instant: Date, timeZone: string): string {
  return toShopClock(instant, timeZone).toPlainTime().toString({ smallestUnit: "minute" });
}

// 0 = Sunday ... 6 = Saturday, the numbering working_hours.weekday uses.
export function weekdayOf(shopDate: string): number {
  // Temporal counts Monday as 1 and Sunday as 7.
  return Temporal.PlainDate.from(shopDate).dayOfWeek % 7;
}

export function addDays(shopDate: string, days: number): string {
  return Temporal.PlainDate.from(shopDate).add({ days }).toString();
}

// Prisma reads and writes a DATE column as midnight UTC of that date.
export function toDateColumn(shopDate: string): Date {
  return new Date(`${shopDate}T00:00:00Z`);
}
