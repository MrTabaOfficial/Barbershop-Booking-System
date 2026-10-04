import { useState } from "react";
import { useSchedule } from "../api/barberQueries.ts";
import { useShop } from "../api/queries.ts";
import { countAppointments, DayAgenda, describeHours } from "../barber/DayAgenda.tsx";
import { DaysOff } from "../barber/DaysOff.tsx";
import { Button, TEXT_LINK } from "../components/Button.tsx";
import { ErrorState, LoadingBlock } from "../components/States.tsx";
import { t } from "../i18n/index.ts";
import { Tag } from "../components/Tag.tsx";
import { addDays, formatLongDate, formatShortDate, startOfWeek } from "../lib/dates.ts";

function Today({ today }: { today: string }) {
  const schedule = useSchedule(today, today);
  const day = schedule.data?.[0];

  return (
    <section aria-labelledby="today-title" className="rounded-lg bg-surface p-4 sm:p-6 lg:row-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-title" className="text-xl">
          {t("barber.today")}
        </h2>
        {day && <p className="text-sm text-muted">{countAppointments(day)}</p>}
      </div>
      <p className="mt-1">{formatLongDate(today)}</p>
      {day && <p className="text-sm text-muted">{describeHours(day)}</p>}
      <div className="mt-4">
        {schedule.isError ? (
          <ErrorState
            title={t("barber.todayError")}
            error={schedule.error}
            onRetry={() => void schedule.refetch()}
          />
        ) : day ? (
          <DayAgenda day={day} markNow />
        ) : (
          <LoadingBlock label={t("barber.todayLoading")} />
        )}
      </div>
    </section>
  );
}

function Week({ today }: { today: string }) {
  const thisWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const weekEnd = addDays(weekStart, 6);
  const schedule = useSchedule(weekStart, weekEnd);

  return (
    <section aria-labelledby="week-title" className="rounded-lg bg-surface p-4 sm:p-6">
      <h2 id="week-title" className="text-xl">
        {t(weekStart === thisWeek ? "barber.thisWeek" : "barber.week")}
      </h2>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p>{t("common.range", { from: formatShortDate(weekStart), to: formatShortDate(weekEnd) })}</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-3.5"
            aria-label={t("barber.previousWeek")}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            {t("barber.previous")}
          </Button>
          {weekStart !== thisWeek && (
            <Button variant="secondary" className="px-3.5" onClick={() => setWeekStart(thisWeek)}>
              {t("barber.thisWeek")}
            </Button>
          )}
          <Button
            variant="secondary"
            className="px-3.5"
            aria-label={t("barber.nextWeek")}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            {t("barber.next")}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {schedule.isPending ? (
          <LoadingBlock label={t("barber.weekLoading")} rows={7} />
        ) : schedule.isError ? (
          <ErrorState
            title={t("barber.weekError")}
            error={schedule.error}
            onRetry={() => void schedule.refetch()}
          />
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {schedule.data.map((day) => {
              const label = (
                <span>
                  <span className="block font-semibold">
                    {formatShortDate(day.date)}
                    {day.date === today && (
                      <Tag className="ml-2">{t("common.today")}</Tag>
                    )}
                  </span>
                  <span className="block text-sm text-muted">{describeHours(day)}</span>
                </span>
              );
              const row = "flex min-h-14 items-center justify-between gap-3 py-3";

              if (day.bookings.length === 0) {
                return (
                  <div key={day.date} className={row}>
                    {label}
                    <span className="shrink-0 text-sm text-muted">{countAppointments(day)}</span>
                  </div>
                );
              }
              return (
                <details key={day.date} className="group">
                  <summary className={`${row} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                    {label}
                    <span className="shrink-0 text-right text-sm">
                      <span className="block">{countAppointments(day)}</span>
                      <span className={TEXT_LINK}>
                        <span className="group-open:hidden">{t("barber.show")}</span>
                        <span className="hidden group-open:inline">{t("barber.hide")}</span>
                      </span>
                    </span>
                  </summary>
                  <div className="pb-4">
                    <DayAgenda day={day} />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function BarberPage() {
  const shop = useShop();

  function renderBody() {
    if (shop.isError) {
      return (
        <ErrorState
          title={t("barber.scheduleError")}
          error={shop.error}
          onRetry={() => void shop.refetch()}
        />
      );
    }
    if (!shop.data) {
      return <LoadingBlock label={t("barber.scheduleLoading")} />;
    }
    const { today } = shop.data;
    return (
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-3">
        <Today today={today} />
        <Week today={today} />
        <DaysOff today={today} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2.5 pb-16 pt-5 sm:px-3 lg:pt-8">
      <title>{t("barber.title")}</title>
      <h1 className="mb-4 px-2 text-3xl sm:px-3">{t("barber.heading")}</h1>
      {renderBody()}
    </div>
  );
}
