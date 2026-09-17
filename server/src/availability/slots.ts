import { holdsSlot } from "../bookings/status.ts";
import { addDays, shopDateOf, shopTimeToUtc } from "../shop/time.ts";

export const SLOT_STEP_MINUTES = 15;
export const MIN_LEAD_TIME_MINUTES = 60;
export const MAX_DAYS_AHEAD = 60;

const MINUTE_MS = 60_000;

export type SlotInput = {
  // The day to find slots for, as a calendar date in the shop's time zone.
  shopDate: string;
  timeZone: string;
  now: Date;
  // The barber's hours for that weekday, or null if they don't work then.
  workingHours: {
    startMinute: number;
    endMinute: number;
    breakStartMinute: number | null;
    breakEndMinute: number | null;
  } | null;
  isDayOff: boolean;
  durationMinutes: number;
  // The barber's bookings around that day, in any status.
  bookings: { startsAt: Date; endsAt: Date; status: string }[];
};

type Interval = { start: number; end: number };

// Touching intervals don't overlap: one may end exactly when the other starts.
function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

// Returns the free start times for one barber on one day. Pure: it reads
// nothing but its input, so it can be tested without a database or a clock.
export function calculateSlots(input: SlotInput): Date[] {
  const { shopDate, timeZone, now, workingHours } = input;

  if (!workingHours || input.isDayOff) {
    return [];
  }

  // Dates in YYYY-MM-DD form sort correctly as text.
  const lastBookableDate = addDays(shopDateOf(now, timeZone), MAX_DAYS_AHEAD);
  if (shopDate > lastBookableDate) {
    return [];
  }

  // The only place shop clock times become instants. Everything after this
  // is real elapsed time, which is what keeps daylight saving days correct.
  const toInstant = (minutesAfterMidnight: number) =>
    shopTimeToUtc(shopDate, minutesAfterMidnight, timeZone).getTime();

  const opening = toInstant(workingHours.startMinute);
  const closing = toInstant(workingHours.endMinute);

  const busy: Interval[] = input.bookings
    .filter((booking) => holdsSlot(booking.status))
    .map((booking) => ({
      start: booking.startsAt.getTime(),
      end: booking.endsAt.getTime(),
    }));
  if (workingHours.breakStartMinute !== null && workingHours.breakEndMinute !== null) {
    busy.push({
      start: toInstant(workingHours.breakStartMinute),
      end: toInstant(workingHours.breakEndMinute),
    });
  }

  const earliestStart = now.getTime() + MIN_LEAD_TIME_MINUTES * MINUTE_MS;
  const duration = input.durationMinutes * MINUTE_MS;
  const slots: Date[] = [];

  for (
    let start = opening;
    start + duration <= closing;
    start += SLOT_STEP_MINUTES * MINUTE_MS
  ) {
    const candidate = { start, end: start + duration };
    if (start >= earliestStart && !busy.some((interval) => overlaps(candidate, interval))) {
      slots.push(new Date(start));
    }
  }

  return slots;
}
