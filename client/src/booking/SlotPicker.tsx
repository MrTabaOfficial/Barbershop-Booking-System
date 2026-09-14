import { useState } from "react";
import { useAvailability } from "../api/queries.ts";
import type { Shop, Slot } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { addDays, dayParts, daysBetween, formatLongDate, weekdayOf } from "../lib/dates.ts";

const DAYS_PER_PAGE = 7;

type SlotPickerProps = {
  shop: Shop;
  barberId: string;
  serviceId: string;
  // The weekdays this barber works, or null if that isn't known.
  workingWeekdays: ReadonlySet<number> | null;
  // The day being shown. With null, the picker starts on the barber's next
  // working day.
  date: string | null;
  selectedStartsAt: string | null;
  // When moving a booking: its id, so its own slot does not count as taken,
  // and its current start, which is shown but can't be picked.
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

// "Asia/Tbilisi" -> "Tbilisi"
function cityOf(timeZone: string): string {
  return (timeZone.split("/").at(-1) ?? timeZone).replaceAll("_", " ");
}

// A week of day buttons and the free times for the chosen day. Used by the
// booking flow and by the reschedule dialog.
export function SlotPicker({
  shop,
  barberId,
  serviceId,
  workingWeekdays,
  date,
  selectedStartsAt,
  excludeBookingId,
  currentStartsAt,
  onDateChange,
  onSlotSelect,
}: SlotPickerProps) {
  const isWorkingDay = (shopDate: string) =>
    workingWeekdays === null || workingWeekdays.has(weekdayOf(shopDate));

  function firstWorkingDate(): string {
    for (let day = shop.today; day <= shop.lastBookableDate; day = addDays(day, 1)) {
      if (isWorkingDay(day)) {
        return day;
      }
    }
    return shop.today;
  }

  // YYYY-MM-DD dates compare correctly as text.
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

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {formatLongDate(days[0] ?? activeDate)} to {formatLongDate(days.at(-1) ?? activeDate)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="px-3"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Earlier
            </Button>
            <Button
              variant="secondary"
              className="px-3"
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
                  className={`flex min-h-16 w-full flex-col items-center justify-center rounded-sm border text-center transition-colors disabled:cursor-not-allowed disabled:border-line disabled:text-line-strong ${
                    selected
                      ? "border-brass bg-brass text-ink"
                      : "border-line-strong hover:border-brass-light"
                  }`}
                >
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wide">
                    {weekday}
                  </span>
                  <span className="font-display text-lg leading-tight">{dayNumber}</span>
                  <span className="text-[0.6875rem]">{month}</span>
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
                // "HH:MM" strings compare correctly as text too.
                const partSlots = slots.filter(
                  (slot) => slot.localTime >= part.from && slot.localTime < part.to,
                );
                if (partSlots.length === 0) {
                  return null;
                }
                return (
                  <section key={part.label} aria-label={part.label}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                      {part.label}
                    </h4>
                    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {partSlots.map((slot) => {
                        const selected = slot.startsAt === selectedStartsAt;
                        const current = slot.startsAt === currentStartsAt;
                        return (
                          <li key={slot.startsAt}>
                            <button
                              type="button"
                              disabled={current}
                              aria-pressed={selected}
                              onClick={() => onSlotSelect(activeDate, slot)}
                              className={`min-h-11 w-full rounded-sm border text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted ${
                                selected
                                  ? "border-brass bg-brass text-ink"
                                  : "border-line-strong enabled:hover:border-brass-light enabled:hover:text-brass-light"
                              }`}
                            >
                              {slot.localTime}
                              {current && (
                                <span className="block text-[0.625rem] font-semibold uppercase tracking-wider">
                                  Current
                                </span>
                              )}
                            </button>
                          </li>
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
