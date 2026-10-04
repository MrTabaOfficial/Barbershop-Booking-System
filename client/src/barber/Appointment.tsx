import { errorMessage } from "../api/http.ts";
import { type Outcome, useRecordOutcome } from "../api/barberQueries.ts";
import type { BookingStatus, ScheduleBooking } from "../api/types.ts";
import { TEXT_LINK } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { Tag } from "../components/Tag.tsx";
import { t, type TranslationKey } from "../i18n/index.ts";
import { phoneLink } from "../lib/format.ts";

const OUTCOMES: { outcome: Outcome; status: BookingStatus; label: TranslationKey }[] = [
  { outcome: "complete", status: "completed", label: "barber.outcome.completed" },
  { outcome: "no-show", status: "no_show", label: "barber.outcome.noShow" },
];

export function Appointment({
  booking,
  marker,
}: {
  booking: ScheduleBooking;
  marker?: string;
}) {
  const recordOutcome = useRecordOutcome();

  const hasStarted = Date.parse(booking.startsAt) <= Date.now() && booking.status !== "pending";

  const beingRecorded = recordOutcome.isPending
    ? OUTCOMES.find((entry) => entry.outcome === recordOutcome.variables.outcome)
    : undefined;
  const status = beingRecorded?.status ?? booking.status;
  const { name, phone } = booking.customer;

  return (
    <>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-x-3">
        <p className="tabular-nums">
          <span className="block font-semibold">{booking.localTime}</span>
          <span className="block text-sm text-muted">{t("barber.until", { time: booking.localEndTime })}</span>
          {marker && (
            <Tag className="mt-1">{marker}</Tag>
          )}
        </p>
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted">{booking.service.name}</p>
        </div>
        <div className="flex flex-col items-end">
          <StatusBadge status={status} />
          {phone ? (
            <a
              href={phoneLink(phone)}
              aria-label={t("barber.callOn", { name, phone })}
              className={`${TEXT_LINK} -mb-2.5 inline-flex min-h-11 items-center text-sm`}
            >
              <span className="sm:hidden">{t("barber.call")}</span>
              <span className="hidden tabular-nums sm:inline">{phone}</span>
            </a>
          ) : (
            <p className="mt-1.5 text-sm text-muted">{t("barber.noPhone")}</p>
          )}
        </div>
      </div>

      {hasStarted && (
        <div className="mt-2.5 sm:ml-[4.75rem] sm:max-w-xs">
          {status === "confirmed" && <p className="mb-1.5 text-sm text-muted">{t("barber.howDidItGo")}</p>}
          <Segmented
            label={t("barber.howDidItGo")}
            options={OUTCOMES.map((entry) => ({ value: entry.outcome, label: t(entry.label) }))}
            value={OUTCOMES.find((entry) => entry.status === status)?.outcome ?? null}
            disabled={recordOutcome.isPending}
            onChange={(outcome) => recordOutcome.mutate({ bookingId: booking.id, outcome })}
          />
        </div>
      )}

      {recordOutcome.isError && (
        <Notice tone="error" className="mt-2.5">
          {errorMessage(recordOutcome.error)}
        </Notice>
      )}
    </>
  );
}
