import { startOfWeek } from "../lib/dates.ts";

const NICE_STEPS = [1, 2, 5];
const MOST_INTERVALS = 4;

export function axisTicks(highest: number, smallestStep = 1): number[] {
  for (let magnitude = smallestStep; ; magnitude *= 10) {
    for (const multiple of NICE_STEPS) {
      const step = multiple * magnitude;
      const intervals = Math.max(Math.ceil(highest / step), 1);
      if (intervals <= MOST_INTERVALS) {
        return Array.from({ length: intervals + 1 }, (_, index) => index * step);
      }
    }
  }
}

export type DayFigures = { date: string; bookings: number; revenueCents: number };
export type PeriodFigures = { from: string; to: string; bookings: number; revenueCents: number };

export function groupByWeek(days: DayFigures[]): PeriodFigures[] {
  const weeks: PeriodFigures[] = [];
  for (const day of days) {
    const week = weeks.at(-1);
    if (week && startOfWeek(week.from) === startOfWeek(day.date)) {
      week.to = day.date;
      week.bookings += day.bookings;
      week.revenueCents += day.revenueCents;
    } else {
      weeks.push({ from: day.date, to: day.date, bookings: day.bookings, revenueCents: day.revenueCents });
    }
  }
  return weeks;
}
