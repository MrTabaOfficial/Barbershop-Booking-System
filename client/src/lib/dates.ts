import { t } from "../i18n/index.ts";

// Shop dates are handled as midnight UTC, so the visitor's own time zone
// never enters the calendar arithmetic.

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

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / DAY_MS);
}

export function weekdayOf(shopDate: string): number {
  return toUtcMidnight(shopDate).getUTCDay();
}

export function startOfWeek(shopDate: string): string {
  const daysSinceMonday = (weekdayOf(shopDate) + 6) % 7;
  return addDays(shopDate, -daysSinceMonday);
}

// Day and month names come from the dictionaries rather than Intl, because
// not every browser build carries Georgian locale data.
export function weekdayName(weekday: number, style: "long" | "short"): string {
  return t(style === "long" ? "date.weekdaysLong" : "date.weekdaysShort").split(",")[weekday] ?? "";
}

function monthName(month: number, style: "long" | "short"): string {
  return t(style === "long" ? "date.monthsLong" : "date.monthsShort").split(",")[month] ?? "";
}

export function formatLongDate(shopDate: string): string {
  const date = toUtcMidnight(shopDate);
  return t("date.long", {
    weekday: weekdayName(date.getUTCDay(), "long"),
    day: date.getUTCDate(),
    month: monthName(date.getUTCMonth(), "long"),
  });
}

export function dayParts(shopDate: string): { weekday: string; day: string; month: string } {
  const date = toUtcMidnight(shopDate);
  return {
    weekday: weekdayName(date.getUTCDay(), "short"),
    day: String(date.getUTCDate()),
    month: monthName(date.getUTCMonth(), "short"),
  };
}

export function shopClockOf(instant: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function formatShortDate(shopDate: string, { weekday = true } = {}): string {
  const parts = dayParts(shopDate);
  return t(weekday ? "date.short" : "date.dayMonth", parts);
}
