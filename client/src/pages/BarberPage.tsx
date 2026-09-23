import { useState } from "react";
import { useSchedule } from "../api/barberQueries.ts";
import { useShop } from "../api/queries.ts";
import { countAppointments, DayAgenda, describeHours } from "../barber/DayAgenda.tsx";
import { DaysOff } from "../barber/DaysOff.tsx";
import { Button } from "../components/Button.tsx";
import { ErrorState, LoadingBlock } from "../components/States.tsx";
import { addDays, dayParts, formatLongDate, startOfWeek } from "../lib/dates.ts";

function shortDate(shopDate: string): string {
  const { weekday, day, month } = dayParts(shopDate);
  return `${weekday} ${day} ${month}`;
}

function Today({ today }: { today: string }) {
  const schedule = useSchedule(today, today);
  const day = schedule.data?.[0];

  return (
    <section aria-labelledby="today-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-title" className="text-xl">
          Today
        </h2>
        {day && <p className="text-sm text-muted">{countAppointments(day)}</p>}
      </div>
      <p className="mt-1">{formatLongDate(today)}</p>
      {day && <p className="text-sm text-muted">{describeHours(day)}</p>}
      <div className="mt-4">
        {schedule.isError ? (
          <ErrorState
            title="We couldn't load today's appointments"
            error={schedule.error}
            onRetry={() => void schedule.refetch()}
          />
        ) : day ? (
          <DayAgenda day={day} />
        ) : (
          <LoadingBlock label="Loading today's appointments" />
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
    <section aria-labelledby="week-title">
      <h2 id="week-title" className="text-xl">
        {weekStart === thisWeek ? "This week" : "Week"}
      </h2>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p>
          {shortDate(weekStart)} to {shortDate(weekEnd)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-3.5"
            aria-label="Previous week"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            Previous
          </Button>
          {weekStart !== thisWeek && (
            <Button variant="secondary" className="px-3.5" onClick={() => setWeekStart(thisWeek)}>
              This week
            </Button>
          )}
          <Button
            variant="secondary"
            className="px-3.5"
            aria-label="Next week"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {schedule.isPending ? (
          <LoadingBlock label="Loading the week" rows={7} />
        ) : schedule.isError ? (
          <ErrorState
            title="We couldn't load this week"
            error={schedule.error}
            onRetry={() => void schedule.refetch()}
          />
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {schedule.data.map((day) => {
              const label = (
                <span>
                  <span className="block font-semibold">
                    {shortDate(day.date)}
                    {day.date === today && (
                      <span className="ml-2 rounded-sm bg-action-tint px-1.5 py-0.5 text-xs text-action-hover">
                        Today
                      </span>
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
                      <span className="font-semibold text-action underline decoration-2 underline-offset-4">
                        <span className="group-open:hidden">Show</span>
                        <span className="hidden group-open:inline">Hide</span>
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
          title="We couldn't load your schedule"
          error={shop.error}
          onRetry={() => void shop.refetch()}
        />
      );
    }
    if (!shop.data) {
      return <LoadingBlock label="Loading your schedule" />;
    }
    const { today } = shop.data;
    return (
      <div className="space-y-12">
        <Today today={today} />
        <Week today={today} />
        <section aria-labelledby="days-off-title">
          <h2 id="days-off-title" className="mb-3 text-xl">
            Days off
          </h2>
          <DaysOff today={today} />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <title>Schedule · Dalaki</title>
      <h1 className="mb-6 text-3xl">Schedule</h1>
      {renderBody()}
    </div>
  );
}
