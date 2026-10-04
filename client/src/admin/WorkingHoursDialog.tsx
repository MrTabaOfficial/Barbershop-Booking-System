import { useState } from "react";
import { useSaveWorkingHours } from "../api/adminQueries.ts";
import { ApiError, errorMessage } from "../api/http.ts";
import type { AdminBarber, WorkingDay } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { t, type TranslationKey } from "../i18n/index.ts";
import { weekdayName } from "../lib/dates.ts";
import { formatClock, parseClock } from "../lib/format.ts";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const FIELDS: [keyof Omit<Row, "works">, TranslationKey][] = [
  ["start", "hours.start"],
  ["end", "hours.end"],
  ["breakStart", "hours.breakFrom"],
  ["breakEnd", "hours.breakTo"],
];

type Row = { works: boolean; start: string; end: string; breakStart: string; breakEnd: string };

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
  const WEEK = WEEKDAYS.map((weekday) => ({ weekday, name: weekdayName(weekday, "long") }));
  const [rows, setRows] = useState<Row[]>(() =>
    WEEK.map(({ weekday }) => toRow(barber.workingHours.find((day) => day.weekday === weekday))),
  );

  const change = (index: number, changes: Partial<Row>) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, ...changes } : row)));

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
      title={t("hours.title", { name: barber.name })}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("services.discard")}
          </Button>
          <Button loading={saveWorkingHours.isPending} loadingLabel={t("services.saving")} onClick={save}>
            {t("hours.save")}
          </Button>
        </>
      }
    >
      <p className="text-muted">{t("hours.intro")}</p>

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
                  className="size-5 accent-action"
                  checked={row.works}
                  onChange={(event) => change(index, { works: event.target.checked })}
                />
                {name}
                {!row.works && <span className="font-normal text-muted">{t("hours.notWorking")}</span>}
              </label>
              {row.works && (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {FIELDS.map(([field, label]) => (
                    <Input
                      key={field}
                      label={t(label)}
                      type="time"
                      step={900}
                      aria-label={t("hours.field", { day: name, field: t(label).toLowerCase() })}
                      value={row[field]}
                      onChange={(event) => change(index, { [field]: event.target.value })}
                    />
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
