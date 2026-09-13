import type { Barber, WorkingHours } from "../api/types.ts";

// Weekday numbers (0 = Sunday) in the order a week is usually listed.
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

const SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Summarises the days a barber works: "Tue to Sat", or "Mon, Wed, Fri"
// when the days aren't in a row.
export function describeWorkingDays(workingHours: WorkingHours[]): string {
  const worked = new Set(workingHours.map((hours) => hours.weekday));

  // Split the week into runs of consecutive working days.
  const runs: string[][] = [];
  let currentRun: string[] = [];
  for (const weekday of MONDAY_FIRST) {
    if (worked.has(weekday)) {
      currentRun.push(SHORT_NAMES[weekday] ?? "");
    } else if (currentRun.length > 0) {
      runs.push(currentRun);
      currentRun = [];
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  return runs
    .map((run) => (run.length > 2 ? `${run[0]} to ${run.at(-1)}` : run.join(", ")))
    .join(", ");
}

export type OpeningDay = {
  weekday: number;
  name: string;
  // Minutes after midnight, or null when the shop is closed that day.
  hours: { opens: number; closes: number } | null;
};

// The shop has no hours of its own: it is open whenever at least one barber
// is working, from the earliest start to the latest finish.
export function shopOpeningHours(barbers: Barber[]): OpeningDay[] {
  return MONDAY_FIRST.map((weekday) => {
    const shifts = barbers.flatMap((barber) =>
      barber.workingHours.filter((hours) => hours.weekday === weekday),
    );
    return {
      weekday,
      name: LONG_NAMES[weekday] ?? "",
      hours:
        shifts.length === 0
          ? null
          : {
              opens: Math.min(...shifts.map((shift) => shift.startMinute)),
              closes: Math.max(...shifts.map((shift) => shift.endMinute)),
            },
    };
  });
}
