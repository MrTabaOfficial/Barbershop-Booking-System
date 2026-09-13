// Helpers for "shop dates": calendar dates in the shop's time zone, written
// YYYY-MM-DD. They are plain calendar arithmetic, so each date is handled
// as midnight UTC and the visitor's own time zone never comes into it.

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(shopDate: string): Date {
  return new Date(`${shopDate}T00:00:00Z`);
}

export function isShopDate(value: string | null): value is string {
  return (
    value !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(toUtcMidnight(value).getTime())
  );
}

export function addDays(shopDate: string, days: number): string {
  return new Date(toUtcMidnight(shopDate).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// How many days `to` is after `from`.
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / DAY_MS);
}

// 0 = Sunday ... 6 = Saturday, the numbering the API uses for working hours.
export function weekdayOf(shopDate: string): number {
  return toUtcMidnight(shopDate).getUTCDay();
}

const longDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// "Tuesday 6 October"
export function formatLongDate(shopDate: string): string {
  return longDateFormat.format(toUtcMidnight(shopDate));
}

const dayPartsFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// The pieces of a date, for the day buttons in the date picker.
export function dayParts(shopDate: string): { weekday: string; day: string; month: string } {
  const parts = dayPartsFormat.formatToParts(toUtcMidnight(shopDate));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}
