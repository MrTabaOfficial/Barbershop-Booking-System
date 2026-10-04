import { useSearchParams } from "react-router";
import { useOverview } from "../api/adminQueries.ts";
import { useShop } from "../api/queries.ts";
import type { BookingStatus, Overview } from "../api/types.ts";
import { TEXT_LINK } from "../components/Button.tsx";
import { Input } from "../components/Input.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { statusLabel } from "../components/StatusBadge.tsx";
import { t } from "../i18n/index.ts";
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
      <EmptyState title={t("overview.empty")}>{t("overview.emptyHint")}</EmptyState>
    );
  }

  const byWeek = perDay.length > MOST_DAILY_COLUMNS;
  const periods = byWeek
    ? groupByWeek(perDay).map((week) => ({
        ...week,
        label:
          week.from === week.to
            ? formatLongDate(week.from)
            : t("common.range", { from: shortDate(week.from), to: shortDate(week.to) }),
      }))
    : perDay.map((day) => ({ ...day, from: day.date, label: formatLongDate(day.date) }));
  const hint = t(byWeek ? "overview.hintWeek" : "overview.hintDay");
  const columnsOf = (measure: "bookings" | "revenueCents") =>
    periods.map((period) => ({
      key: period.from,
      label: period.label,
      shortLabel: shortDate(period.from),
      value: period[measure],
    }));

  return (
    <div className="grid gap-2.5 lg:gap-3">
      <h2 className="sr-only">{t("overview.keyFigures")}</h2>
      <dl className="rounded-lg bg-surface p-4 sm:p-6 divide-y divide-line md:grid md:grid-cols-[1.5fr_1fr_1fr_1fr] md:divide-y-0">
        <Figure
          lead
          label={t("overview.revenue")}
          value={formatPrice(totals.revenueCents)}
          note={t("overview.revenueNote")}
        />
        <Figure
          label={t("overview.bookings")}
          value={String(totals.bookings)}
          note={t("overview.bookingsNote")}
        />
        <Figure
          label={t("overview.noShowRate")}
          value={noShowRate === null ? "–" : formatPercent(noShowRate)}
          note={t("overview.noShowNote")}
        />
        <Figure
          label={t("overview.cancelled")}
          value={String(byStatus.cancelled)}
          note={t("overview.cancelledNote")}
        />
      </dl>

      <div className="grid gap-2.5 md:grid-cols-2 lg:gap-3">
        <div className="rounded-lg bg-surface p-4 sm:p-6">
          <ColumnChart
            title={t(byWeek ? "overview.bookingsPerWeek" : "overview.bookingsPerDay")}
            hint={hint}
            columns={columnsOf("bookings")}
            formatValue={String}
          />
        </div>
        <div className="rounded-lg bg-surface p-4 sm:p-6">
          <ColumnChart
            title={t(byWeek ? "overview.revenuePerWeek" : "overview.revenuePerDay")}
            hint={hint}
            columns={columnsOf("revenueCents")}
            smallestStep={WHOLE_LARI}
            formatValue={formatPrice}
          />
        </div>
        <div className="rounded-lg bg-surface p-4 sm:p-6">
          <BarList
            title={t("overview.byStatus")}
            rows={STATUS_ORDER.map((status) => ({
              label: statusLabel(status),
              value: byStatus[status],
            }))}
          />
        </div>
        {topServices.length > 0 && (
          <div className="rounded-lg bg-surface p-4 sm:p-6">
            <BarList
              title={t("overview.topServices")}
              rows={topServices.map((service) => ({ label: service.name, value: service.bookings }))}
            />
          </div>
        )}
      </div>

      <details className="rounded-lg bg-surface p-4 sm:p-6">
        <summary className={`${TEXT_LINK} cursor-pointer py-2.5`}>
          {t(byWeek ? "overview.tableWeekly" : "overview.tableDaily")}
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink text-xs text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  {t(byWeek ? "overview.week" : "overview.day")}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  {t("overview.bookings")}
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  {t("overview.revenue")}
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 px-0.5 sm:px-1.5 md:flex-row md:items-end">
        <Segmented
          label={t("overview.period")}
          className="md:w-[22rem] lg:w-[26rem]"
          options={PRESET_DAYS.map((days) => ({ value: days, label: t("overview.lastDays", { days }) }))}
          value={preset}
          onChange={(days) => setRange(startOfPreset(days), today)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("overview.from")}
            type="date"
            value={from}
            max={to}
            onChange={(event) => event.target.value && setRange(event.target.value, to)}
          />
          <Input
            label={t("overview.to")}
            type="date"
            value={to}
            min={from}
            onChange={(event) => event.target.value && setRange(from, event.target.value)}
          />
        </div>
      </div>

      {overview.isError ? (
        <ErrorState
          title={t("overview.loadError")}
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : overview.data ? (
        <div className={overview.isPlaceholderData ? "opacity-50 transition-opacity" : ""}>
          <Figures overview={overview.data} />
        </div>
      ) : (
        <LoadingBlock label={t("overview.loading")} rows={4} />
      )}
    </div>
  );
}

export function OverviewPage() {
  const shop = useShop();

  return (
    <>
      <title>{`${t("admin.overview")} ${t("admin.titleSuffix")}`}</title>
      <h1 className="sr-only">{t("admin.overview")}</h1>
      {shop.isError ? (
        <ErrorState
          title={t("overview.loadError")}
          error={shop.error}
          onRetry={() => void shop.refetch()}
        />
      ) : shop.data ? (
        <OverviewFor today={shop.data.today} />
      ) : (
        <LoadingBlock label={t("overview.loading")} rows={4} />
      )}
    </>
  );
}
