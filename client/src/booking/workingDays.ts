import type { Barber, WorkingHours } from "../api/types.ts";
import { t } from "../i18n/index.ts";
import { weekdayName } from "../lib/dates.ts";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function describeWorkingDays(workingHours: WorkingHours[]): string {
  const worked = new Set(workingHours.map((hours) => hours.weekday));

  const runs: string[][] = [];
  let currentRun: string[] = [];
  for (const weekday of MONDAY_FIRST) {
    if (worked.has(weekday)) {
      currentRun.push(weekdayName(weekday, "short"));
    } else if (currentRun.length > 0) {
      runs.push(currentRun);
      currentRun = [];
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  return runs
    .map((run) =>
      run.length > 2 ? t("common.range", { from: run[0] ?? "", to: run.at(-1) ?? "" }) : run.join(", "),
    )
    .join(", ");
}

export type OpeningDay = {
  weekday: number;
  name: string;
  hours: { opens: number; closes: number } | null;
};

export function shopOpeningHours(barbers: Barber[]): OpeningDay[] {
  return MONDAY_FIRST.map((weekday) => {
    const shifts = barbers.flatMap((barber) =>
      barber.workingHours.filter((hours) => hours.weekday === weekday),
    );
    return {
      weekday,
      name: weekdayName(weekday, "long"),
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
