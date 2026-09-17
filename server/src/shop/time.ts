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

// Minutes after midnight on the shop's clock: 600 at 10:00.
export function shopMinutesOf(instant: Date, timeZone: string): number {
  const clock = toShopClock(instant, timeZone);
  return clock.hour * 60 + clock.minute;
}

// "HH:MM" on the shop's clock.
export function shopClockTimeOf(instant: Date, timeZone: string): string {
  return toShopClock(instant, timeZone).toPlainTime().toString({ smallestUnit: "minute" });
}

// A Date whose UTC fields read as the shop's clock at that instant. It is
// not a real instant: it is for formats that have no time zones, such as
// spreadsheets, where "15:00" has to mean 15:00 in the shop.
export function shopClockAsUtc(instant: Date, timeZone: string): Date {
  const clock = toShopClock(instant, timeZone);
  return new Date(
    Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second),
  );
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

export function fromDateColumn(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// "Tuesday 6 October", for messages.
export function formatShopDate(shopDate: string): string {
  return Temporal.PlainDate.from(shopDate).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// How many days `to` is after `from`.
export function daysBetween(from: string, to: string): number {
  return Temporal.PlainDate.from(from).until(to).days;
}
