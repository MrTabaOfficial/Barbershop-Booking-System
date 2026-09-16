import { useState } from "react";
import { useSaveWorkingHours } from "../api/adminQueries.ts";
import { ApiError, errorMessage } from "../api/http.ts";
import type { AdminBarber, WorkingDay } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Notice } from "../components/Notice.tsx";
import { formatClock, parseClock } from "../lib/format.ts";

// Weekday numbers (0 = Sunday) in the order a week is usually listed.
const WEEK = [
  { weekday: 1, name: "Monday" },
  { weekday: 2, name: "Tuesday" },
  { weekday: 3, name: "Wednesday" },
  { weekday: 4, name: "Thursday" },
  { weekday: 5, name: "Friday" },
  { weekday: 6, name: "Saturday" },
  { weekday: 0, name: "Sunday" },
];

// One row of the form. The times are kept as the text the time inputs
// produce ("10:00", or "" when empty).
type Row = { works: boolean; start: string; end: string; breakStart: string; breakEnd: string };

const TIME_INPUT =
  "min-h-11 w-full rounded-sm border border-line-strong bg-ink px-2 text-cream disabled:border-line disabled:text-line-strong";

function toRow(day: WorkingDay | undefined): Row {
  const clock = (minute: number | null | undefined) =>
    minute === null || minute === undefined ? "" : formatClock(minute);
  return {
    works: day !== undefined,
    start: clock(day?.startMinute) || "10:00",
    end: clock(day?.endMinute) || "19:00",
    breakStart: clock(day?.breakStartMinute),
    breakEnd: clock(day?.breakEndMinute),
  };
}

export function WorkingHoursDialog({ barber, onClose }: { barber: AdminBarber; onClose: () => void }) {
  const saveWorkingHours = useSaveWorkingHours();
  const [rows, setRows] = useState<Row[]>(() =>
    WEEK.map(({ weekday }) => toRow(barber.workingHours.find((day) => day.weekday === weekday))),
  );

  const change = (index: number, changes: Partial<Row>) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, ...changes } : row)));

  // The days the barber works, in the API's form. The server checks the
  // times against each other and its messages are shown below.
  const days: (WorkingDay & { name: string })[] = WEEK.flatMap(({ weekday, name }, index) => {
    const row = rows[index];
    if (!row?.works) {
      return [];
    }
    return [
      {
        name,
        weekday,
        startMinute: parseClock(row.start) ?? 0,
        endMinute: parseClock(row.end) ?? 0,
        breakStartMinute: parseClock(row.breakStart),
        breakEndMinute: parseClock(row.breakEnd),
      },
    ];
  });

  function save() {
    saveWorkingHours.mutate(
      { barberId: barber.id, days: days.map(({ name: _name, ...day }) => day) },
      { onSuccess: onClose },
    );
  }

  // The server names a problem by its place in the list it was sent
  // ("days.2.endMinute"). Turn that back into the weekday it belongs to.
  const { error } = saveWorkingHours;
  const problems =
    error instanceof ApiError
      ? error.fieldIssues.map((issue) => {
          const day = days[Number(issue.path.split(".")[1])];
          return day ? `${day.name}: ${issue.message}` : issue.message;
        })
      : [];

  return (
    <Dialog
      title={`${barber.name}'s working hours`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Discard
          </Button>
          <Button loading={saveWorkingHours.isPending} loadingLabel="Saving…" onClick={save}>
            Save hours
          </Button>
        </>
      }
    >
      <p className="text-muted">
        Times are on the shop's clock. Leave the break empty for a day without one. Bookings
        already made are not moved if the hours change.
      </p>

      {error && (
        <Notice tone="error">
          {problems.length === 0 ? (
            errorMessage(error)
          ) : (
            <ul className="space-y-1">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <div className="divide-y divide-line border-y border-line">
        {WEEK.map(({ weekday, name }, index) => {
          const row = rows[index];
          if (!row) {
            return null;
          }
          return (
            <fieldset key={weekday} className="py-3">
              <legend className="sr-only">{name}</legend>
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-brass"
                  checked={row.works}
                  onChange={(event) => change(index, { works: event.target.checked })}
                />
                {name}
                {!row.works && <span className="font-normal text-muted">Not working</span>}
              </label>
              {row.works && (
                // Two columns, so a browser that shows AM and PM has room.
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {(
                    [
                      ["start", "Start"],
                      ["end", "End"],
                      ["breakStart", "Break from"],
                      ["breakEnd", "Break to"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="block text-xs text-muted">
                      {label}
                      <input
                        type="time"
                        step={900}
                        aria-label={`${name}: ${label.toLowerCase()}`}
                        className={`${TIME_INPUT} mt-1 block text-base`}
                        value={row[field]}
                        onChange={(event) => change(index, { [field]: event.target.value })}
                      />
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    </Dialog>
  );
}
