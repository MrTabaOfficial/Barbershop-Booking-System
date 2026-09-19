// Temporal's default handling of daylight saving is what the shop wants: a
// clock time that is skipped moves to the first moment after the gap, and one
// that happens twice means the first occurrence.

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

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

export function shopMinutesOf(instant: Date, timeZone: string): number {
  const clock = toShopClock(instant, timeZone);
  return clock.hour * 60 + clock.minute;
}

export function shopClockTimeOf(instant: Date, timeZone: string): string {
  return toShopClock(instant, timeZone).toPlainTime().toString({ smallestUnit: "minute" });
}

// The result is not a real instant: its UTC fields read as the shop's clock,
// for formats that have no time zones, such as spreadsheets.
export function shopClockAsUtc(instant: Date, timeZone: string): Date {
  const clock = toShopClock(instant, timeZone);
  return new Date(
    Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second),
  );
}

export function weekdayOf(shopDate: string): number {
  // Temporal counts Monday as 1 and Sunday as 7, while working_hours.weekday
  // counts Sunday as 0.
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

export function formatShopDate(shopDate: string): string {
  return Temporal.PlainDate.from(shopDate).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function daysBetween(from: string, to: string): number {
  return Temporal.PlainDate.from(from).until(to).days;
}
