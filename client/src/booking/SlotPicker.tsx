import { Fragment, useState } from "react";
import { useAvailability } from "../api/queries.ts";
import type { Shop, Slot, WorkingHours } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { addDays, dayParts, daysBetween, formatLongDate, weekdayOf } from "../lib/dates.ts";
import { formatClock } from "../lib/format.ts";

const DAYS_PER_PAGE = 7;

type SlotPickerProps = {
  shop: Shop;
  barberId: string;
  serviceId: string;
  workingHours: WorkingHours[] | null;
  date: string | null;
  selectedStartsAt: string | null;
  excludeBookingId?: string;
  currentStartsAt?: string;
  onDateChange: (date: string) => void;
  onSlotSelect: (date: string, slot: Slot) => void;
};

const PARTS_OF_DAY = [
  { label: "Morning", from: "00:00", to: "12:00" },
  { label: "Afternoon", from: "12:00", to: "17:00" },
  { label: "Evening", from: "17:00", to: "24:00" },
];

function shortDate(shopDate: string): string {
  const { weekday, day, month } = dayParts(shopDate);
  return `${weekday} ${day} ${month}`;
}

function cityOf(timeZone: string): string {
  return (timeZone.split("/").at(-1) ?? timeZone).replaceAll("_", " ");
}

export function SlotPicker({
  shop,
  barberId,
  serviceId,
  workingHours,
  date,
  selectedStartsAt,
  excludeBookingId,
  currentStartsAt,
  onDateChange,
  onSlotSelect,
}: SlotPickerProps) {
  const hoursOn = (shopDate: string) =>
    workingHours?.find((hours) => hours.weekday === weekdayOf(shopDate));
  const isWorkingDay = (shopDate: string) => workingHours === null || hoursOn(shopDate) !== undefined;

  function firstWorkingDate(): string {
    for (let day = shop.today; day <= shop.lastBookableDate; day = addDays(day, 1)) {
      if (isWorkingDay(day)) {
        return day;
      }
    }
    return shop.today;
  }

  const isBookable = date !== null && date >= shop.today && date <= shop.lastBookableDate;
  const activeDate = isBookable ? date : firstWorkingDate();

  const lastPage = Math.floor(daysBetween(shop.today, shop.lastBookableDate) / DAYS_PER_PAGE);
  const [page, setPage] = useState(() =>
    Math.floor(daysBetween(shop.today, activeDate) / DAYS_PER_PAGE),
  );
  const days = Array.from({ length: DAYS_PER_PAGE }, (_, index) =>
    addDays(shop.today, page * DAYS_PER_PAGE + index),
  ).filter((day) => day <= shop.lastBookableDate);

  const availability = useAvailability({
    barberId,
    serviceId,
    date: activeDate,
    excludeBookingId,
  });
  const slots = availability.data?.slots ?? [];

  const hours = hoursOn(activeDate);
  const shopBreak =
    hours && hours.breakStartMinute !== null && hours.breakEndMinute !== null
      ? { start: formatClock(hours.breakStartMinute), end: formatClock(hours.breakEndMinute) }
      : null;
  const firstAfterBreak =
    shopBreak && slots.some((slot) => slot.localTime < shopBreak.start)
      ? slots.find((slot) => slot.localTime >= shopBreak.end)?.startsAt
      : undefined;

  return (
    <div className="space-y-7">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {shortDate(days[0] ?? activeDate)} to {shortDate(days.at(-1) ?? activeDate)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="px-3.5"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Earlier
            </Button>
            <Button
              variant="secondary"
              className="px-3.5"
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              Later
            </Button>
          </div>
        </div>

        <ul aria-label="Days" className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((day) => {
            const { weekday, day: dayNumber, month } = dayParts(day);
            const selected = day === activeDate;
            const working = isWorkingDay(day);
            return (
              <li key={day}>
                <button
                  type="button"
                  disabled={!working}
                  aria-pressed={selected}
                  aria-label={`${formatLongDate(day)}${working ? "" : ", not a working day"}`}
                  onClick={() => onDateChange(day)}
                  className={`flex min-h-[4.5rem] w-full flex-col items-center justify-center rounded-md border text-center text-xs leading-tight transition-colors duration-120 ease-standard disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-faint lg:min-h-20 ${
                    selected
                      ? "border-action bg-action text-on-action"
                      : "border-edge bg-surface text-muted enabled:hover:border-action enabled:hover:ring-1 enabled:hover:ring-inset enabled:hover:ring-action"
                  }`}
                >
                  <span>{weekday}</span>
                  <span
                    className={`text-xl font-extrabold tabular-nums ${
                      working && !selected ? "text-ink" : ""
                    }`}
                  >
                    {dayNumber}
                  </span>
                  <span>{month}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xl">{formatLongDate(activeDate)}</h3>
        <p className="mt-1 text-sm text-muted">
          Times are shown in {cityOf(shop.timeZone)} time.
        </p>

        <div className="mt-4">
          {availability.isPending ? (
            <LoadingBlock label="Loading free times" rows={2} />
          ) : availability.isError ? (
            <ErrorState
              title="We couldn't load the free times"
              error={availability.error}
              onRetry={() => void availability.refetch()}
            />
          ) : slots.length === 0 ? (
            <EmptyState title="No free times on this day">
              Every slot is taken or the barber is away. Try another day.
            </EmptyState>
          ) : (
            <div className="space-y-5">
              {PARTS_OF_DAY.map((part) => {
                const partSlots = slots.filter(
                  (slot) => slot.localTime >= part.from && slot.localTime < part.to,
                );
                if (partSlots.length === 0) {
                  return null;
                }
                return (
                  <section key={part.label} aria-label={part.label}>
                    <h4 className="mb-2 text-sm font-semibold">{part.label}</h4>
                    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {partSlots.map((slot) => {
                        const selected = slot.startsAt === selectedStartsAt;
                        const current = slot.startsAt === currentStartsAt;
                        return (
                          <Fragment key={slot.startsAt}>
                            {shopBreak && slot.startsAt === firstAfterBreak && (
                              <li className="col-span-full flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                                Break {shopBreak.start} to {shopBreak.end}
                              </li>
                            )}
                            <li>
                              <button
                                type="button"
                                disabled={current}
                                aria-pressed={selected}
                                onClick={() => onSlotSelect(activeDate, slot)}
                                className={`min-h-12 w-full rounded-md border leading-tight tabular-nums transition-colors duration-120 ease-standard disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sunken disabled:text-muted ${
                                  selected
                                    ? "border-action bg-action font-semibold text-on-action"
                                    : "border-edge bg-surface enabled:hover:border-action enabled:hover:text-action-hover enabled:hover:ring-1 enabled:hover:ring-inset enabled:hover:ring-action enabled:active:bg-action-tint"
                                }`}
                              >
                                {slot.localTime}
                                {current && (
                                  <span className="block text-[0.6875rem] font-semibold">
                                    Current
                                  </span>
                                )}
                              </button>
                            </li>
                          </Fragment>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
