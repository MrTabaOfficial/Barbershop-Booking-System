import { useSearchParams } from "react-router";
import { useOverview } from "../api/adminQueries.ts";
import { useShop } from "../api/queries.ts";
import type { BookingStatus, Overview } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { Input } from "../components/Input.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { statusLabel } from "../components/StatusBadge.tsx";
import { addDays, dayParts, formatLongDate, isShopDate } from "../lib/dates.ts";
import { formatPercent, formatPrice } from "../lib/format.ts";
import { BarList, ColumnChart } from "./charts.tsx";

const PRESET_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 30;
const STATUS_ORDER: BookingStatus[] = ["completed", "confirmed", "pending", "no_show", "cancelled"];

// A headline number. The value is in the body font: a display face at
// this size reads as decoration rather than as data.
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

function Figures({ overview }: { overview: Overview }) {
  const { totals, byStatus, noShowRate, perDay, topServices } = overview;
  const nothingHappened = Object.values(byStatus).every((count) => count === 0);

  if (nothingHappened) {
    return (
      <EmptyState title="No bookings in this period">
        Try a longer range, or a different one.
      </EmptyState>
    );
  }

  const days = perDay.map((day) => {
    const { day: dayNumber, month } = dayParts(day.date);
    return { ...day, label: formatLongDate(day.date), shortLabel: `${dayNumber} ${month}` };
  });

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings" value={String(totals.bookings)} note="Not counting cancelled" />
        <Stat
          label="Revenue"
          value={formatPrice(totals.revenueCents)}
          note="Completed bookings only"
        />
        <Stat
          label="No-show rate"
          value={noShowRate === null ? "–" : formatPercent(noShowRate)}
          note="Of appointments that reached their time"
        />
        <Stat label="Cancelled" value={String(byStatus.cancelled)} />
      </div>

      {/* Two charts, not one with two scales: bookings and lari can't
          honestly share an axis. */}
      <div className="grid gap-10 lg:grid-cols-2">
        <ColumnChart
          title="Bookings per day"
          columns={days.map((day) => ({ ...day, value: day.bookings }))}
          formatValue={String}
        />
        <ColumnChart
          title="Revenue per day"
          columns={days.map((day) => ({ ...day, value: day.revenueCents }))}
          formatValue={formatPrice}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <BarList
          title="Bookings by status"
          rows={STATUS_ORDER.map((status) => ({
            label: statusLabel(status),
            value: byStatus[status],
          }))}
        />
        {topServices.length > 0 && (
          <BarList
            title="Most booked services"
            rows={topServices.map((service) => ({ label: service.name, value: service.bookings }))}
          />
        )}
      </div>

      {/* The same numbers without the charts, for anyone who can't hover
          or would rather read them. */}
      <details>
        <summary className="cursor-pointer text-sm font-medium text-brass-light underline underline-offset-4">
          Show the daily numbers as a table
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Day
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Bookings
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {days.map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {day.label}
                  </th>
                  <td className="py-2 pr-4 text-right">{day.bookings}</td>
                  <td className="py-2 text-right">{formatPrice(day.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function OverviewFor({ today }: { today: string }) {
  // The range lives in the URL, so it survives a reload and can be shared.
  const [params, setParams] = useSearchParams();
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const to = isShopDate(toParam) ? toParam : today;
  const from = isShopDate(fromParam) ? fromParam : addDays(to, -(DEFAULT_DAYS - 1));
  const overview = useOverview(from, to);

  const setRange = (nextFrom: string, nextTo: string) =>
    setParams({ from: nextFrom, to: nextTo }, { replace: true });

  return (
    <div className="space-y-8">
      {/* One row of filters, above everything they apply to. */}
      <div className="flex flex-wrap items-end gap-3">
        {PRESET_DAYS.map((days) => {
          const presetFrom = addDays(today, -(days - 1));
          const selected = from === presetFrom && to === today;
          return (
            <Button
              key={days}
              variant={selected ? "primary" : "secondary"}
              aria-pressed={selected}
              onClick={() => setRange(presetFrom, today)}
            >
              Last {days} days
            </Button>
          );
        })}
        <Input
          label="From"
          type="date"
          value={from}
          max={to}
          onChange={(event) => event.target.value && setRange(event.target.value, to)}
        />
        <Input
          label="To"
          type="date"
          value={to}
          min={from}
          onChange={(event) => event.target.value && setRange(from, event.target.value)}
        />
      </div>

      {overview.isError ? (
        <ErrorState
          title="We couldn't load the overview"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : overview.data ? (
        // While a new range loads, the previous figures stay in place, dimmed.
        <div className={overview.isPlaceholderData ? "opacity-50 transition-opacity" : ""}>
          <Figures overview={overview.data} />
        </div>
      ) : (
        <LoadingBlock label="Loading the overview" rows={4} />
      )}
    </div>
  );
}

export function OverviewPage() {
  // "Today" is the shop's date, which the server knows.
  const shop = useShop();

  return (
    <>
      <title>Overview · Admin · Dalaki</title>
      <h2 className="sr-only">Overview</h2>
      {shop.isError ? (
        <ErrorState
          title="We couldn't load the overview"
          error={shop.error}
          onRetry={() => void shop.refetch()}
        />
      ) : shop.data ? (
        <OverviewFor today={shop.data.today} />
      ) : (
        <LoadingBlock label="Loading the overview" rows={4} />
      )}
    </>
  );
}
