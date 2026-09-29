import { useSearchParams } from "react-router";
import { useOverview } from "../api/adminQueries.ts";
import { useShop } from "../api/queries.ts";
import type { BookingStatus, Overview } from "../api/types.ts";
import { TEXT_LINK } from "../components/Button.tsx";
import { Input } from "../components/Input.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { statusLabel } from "../components/StatusBadge.tsx";
import { addDays, formatLongDate, formatShortDate, isShopDate } from "../lib/dates.ts";
import { formatPercent, formatPrice } from "../lib/format.ts";
import { groupByWeek } from "./chartMath.ts";
import { BarList, ColumnChart } from "./charts.tsx";

const PRESET_DAYS = ["7", "30", "90"];
const DEFAULT_DAYS = 30;
const MOST_DAILY_COLUMNS = 45;
const WHOLE_LARI = 100;
const STATUS_ORDER: BookingStatus[] = [
  "completed",
  "confirmed",
  "pending",
  "no_show",
  "cancelled",
  "expired",
];

const shortDate = (shopDate: string) => formatShortDate(shopDate, { weekday: false });

function Figure({
  label,
  value,
  note,
  lead = false,
}: {
  label: string;
  value: string;
  note: string;
  lead?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 py-3 md:block md:border-l md:border-line md:px-5 md:py-0 md:first:border-l-0 md:first:pl-0 lg:px-6">
      <dt className="col-start-1 font-semibold md:text-sm md:font-normal md:text-muted">{label}</dt>
      <dd
        className={`col-start-2 row-span-2 row-start-1 self-center text-right font-semibold md:mt-1 md:text-left ${
          lead ? "text-3xl lg:text-4xl" : "text-xl md:text-2xl"
        }`}
      >
        {value}
      </dd>
      <dd className="col-start-1 text-sm text-muted md:mt-1 md:text-xs">{note}</dd>
    </div>
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

  const byWeek = perDay.length > MOST_DAILY_COLUMNS;
  const periods = byWeek
    ? groupByWeek(perDay).map((week) => ({
        ...week,
        label:
          week.from === week.to
            ? formatLongDate(week.from)
            : `${shortDate(week.from)} to ${shortDate(week.to)}`,
      }))
    : perDay.map((day) => ({ ...day, from: day.date, label: formatLongDate(day.date) }));
  const unit = byWeek ? "week" : "day";
  const hint = `Press the left and right arrow keys to read each ${unit}.`;
  const columnsOf = (measure: "bookings" | "revenueCents") =>
    periods.map((period) => ({
      key: period.from,
      label: period.label,
      shortLabel: shortDate(period.from),
      value: period[measure],
    }));

  return (
    <div className="space-y-10">
      <h2 className="sr-only">Key figures</h2>
      <dl className="divide-y divide-line border-y border-line md:grid md:grid-cols-[1.5fr_1fr_1fr_1fr] md:divide-y-0 md:border-y-0">
        <Figure
          lead
          label="Revenue"
          value={formatPrice(totals.revenueCents)}
          note="Completed bookings only"
        />
        <Figure
          label="Bookings"
          value={String(totals.bookings)}
          note="Not counting cancelled or expired"
        />
        <Figure
          label="No-show rate"
          value={noShowRate === null ? "–" : formatPercent(noShowRate)}
          note="Of appointments that reached their time"
        />
        <Figure
          label="Cancelled"
          value={String(byStatus.cancelled)}
          note="By the customer or by the shop"
        />
      </dl>

      <div className="grid gap-10 md:grid-cols-2">
        <ColumnChart
          title={`Bookings per ${unit}`}
          hint={hint}
          columns={columnsOf("bookings")}
          formatValue={String}
        />
        <ColumnChart
          title={`Revenue per ${unit}`}
          hint={hint}
          columns={columnsOf("revenueCents")}
          smallestStep={WHOLE_LARI}
          formatValue={formatPrice}
        />
      </div>

      <div className="grid gap-10 md:grid-cols-2">
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

      <details>
        <summary className={`${TEXT_LINK} cursor-pointer py-2.5`}>
          Show the {byWeek ? "weekly" : "daily"} numbers as a table
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink text-xs text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {byWeek ? "Week" : "Day"}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  Bookings
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {periods.map((period) => (
                <tr key={period.from}>
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {period.label}
                  </th>
                  <td className="py-2 pr-4 text-right">{period.bookings}</td>
                  <td className="py-2 text-right">{formatPrice(period.revenueCents)}</td>
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
  const [params, setParams] = useSearchParams();
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const to = isShopDate(toParam) ? toParam : today;
  const from = isShopDate(fromParam) ? fromParam : addDays(to, -(DEFAULT_DAYS - 1));
  const overview = useOverview(from, to);

  const setRange = (nextFrom: string, nextTo: string) =>
    setParams({ from: nextFrom, to: nextTo }, { replace: true });

  const startOfPreset = (days: string) => addDays(today, -(Number(days) - 1));
  const preset = PRESET_DAYS.find((days) => to === today && from === startOfPreset(days)) ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <Segmented
          label="Period"
          className="md:w-[22rem] lg:w-[26rem]"
          options={PRESET_DAYS.map((days) => ({ value: days, label: `Last ${days} days` }))}
          value={preset}
          onChange={(days) => setRange(startOfPreset(days), today)}
        />
        <div className="grid grid-cols-2 gap-3">
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
      </div>

      {overview.isError ? (
        <ErrorState
          title="We couldn't load the overview"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : overview.data ? (
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
  const shop = useShop();

  return (
    <>
      <title>Overview · Admin · Dalaki</title>
      <h1 className="sr-only">Overview</h1>
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
