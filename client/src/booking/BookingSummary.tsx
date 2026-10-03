import type { ReactNode } from "react";
import type { Barber, Service, Slot } from "../api/types.ts";
import { Card } from "../components/Card.tsx";
import { t } from "../i18n/index.ts";
import { formatLongDate } from "../lib/dates.ts";
import { formatDuration, formatPrice } from "../lib/format.ts";

type BookingSummaryProps = {
  service?: Service;
  barber?: Barber;
  date?: string | null;
  slot?: Slot;
  compact?: boolean;
};

export function BookingSummary({ service, barber, date, slot, compact }: BookingSummaryProps) {
  const rowPadding = compact ? "py-2" : "py-3";

  const row = (label: string, value: ReactNode) => (
    <div className={`flex justify-between gap-4 border-b border-line last:border-b-0 ${rowPadding}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );

  return (
    <Card className={compact ? "py-2 sm:py-3" : ""}>
      {!compact && <h3 className="mb-1 text-lg">{t("summary.title")}</h3>}
      {!service && !barber && <p className="text-muted">{t("summary.start")}</p>}
      <dl>
        {service &&
          row(
            t("summary.service"),
            <>
              {service.name}
              <span className="text-sm font-normal text-muted">
                {compact ? ", " : <br />}
                {formatDuration(service.durationMinutes)}
              </span>
            </>,
          )}
        {barber && row(t("summary.barber"), barber.name)}
        {date &&
          slot &&
          row(t("summary.time"), t("common.dateAt", { date: formatLongDate(date), time: slot.localTime }))}
        {service && (
          <div className={`flex items-baseline justify-between gap-4 ${rowPadding} last:pb-1`}>
            <dt className="text-muted">{t("summary.price")}</dt>
            <dd className="text-xl font-semibold tabular-nums text-action">
              {formatPrice(service.priceCents)}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
