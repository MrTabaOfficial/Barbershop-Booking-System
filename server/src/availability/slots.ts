import { holdsSlot } from "../bookings/status.ts";
import { addDays, shopDateOf, shopTimeToUtc } from "../shop/time.ts";

export const SLOT_STEP_MINUTES = 15;
export const MIN_LEAD_TIME_MINUTES = 60;
export const MAX_DAYS_AHEAD = 60;

const MINUTE_MS = 60_000;

export type SlotInput = {
  shopDate: string;
  timeZone: string;
  now: Date;
  workingHours: {
    startMinute: number;
    endMinute: number;
    breakStartMinute: number | null;
    breakEndMinute: number | null;
  } | null;
  isDayOff: boolean;
  durationMinutes: number;
  bookings: { startsAt: Date; endsAt: Date; status: string }[];
};

type Interval = { start: number; end: number };

// Touching intervals don't overlap: one may end exactly when the other
// starts.
function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

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

  // This is the only place shop clock times become instants; everything after
  // it is real elapsed time, which is what keeps daylight saving days
  // correct.
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
