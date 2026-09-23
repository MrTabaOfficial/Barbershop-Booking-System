import { errorMessage } from "../api/http.ts";
import { type Outcome, useRecordOutcome } from "../api/barberQueries.ts";
import type { BookingStatus, ScheduleBooking } from "../api/types.ts";
import { Notice } from "../components/Notice.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { phoneLink } from "../lib/format.ts";

const OUTCOMES: { outcome: Outcome; status: BookingStatus; label: string }[] = [
  { outcome: "complete", status: "completed", label: "Completed" },
  { outcome: "no-show", status: "no_show", label: "No-show" },
];

export function Appointment({ booking }: { booking: ScheduleBooking }) {
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
          <span className="block font-extrabold">{booking.localTime}</span>
          <span className="block text-sm text-muted">to {booking.localEndTime}</span>
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
              aria-label={`Call ${name} on ${phone}`}
              className="-mb-2.5 inline-flex min-h-11 items-center text-sm font-semibold text-action underline decoration-2 underline-offset-4 transition-colors duration-120 ease-standard hover:text-action-pressed"
            >
              <span className="sm:hidden">Call</span>
              <span className="hidden tabular-nums sm:inline">{phone}</span>
            </a>
          ) : (
            <p className="mt-1.5 text-sm text-muted">No phone</p>
          )}
        </div>
      </div>

      {hasStarted && (
        <div className="mt-2.5 sm:ml-[4.75rem] sm:max-w-xs">
          {status === "confirmed" && <p className="mb-1.5 text-sm text-muted">How did it go?</p>}
          <div
            role="group"
            aria-label="How did it go?"
            className={`grid grid-cols-2 rounded-md border border-edge bg-surface p-0.5 ${
              status === "confirmed" ? "divide-x divide-line" : ""
            }`}
          >
            {OUTCOMES.map((entry) => {
              const chosen = status === entry.status;
              return (
                <button
                  key={entry.outcome}
                  type="button"
                  aria-pressed={chosen}
                  disabled={recordOutcome.isPending}
                  onClick={() => {
                    if (!chosen) {
                      recordOutcome.mutate({ bookingId: booking.id, outcome: entry.outcome });
                    }
                  }}
                  className={`min-h-11 rounded-[10px] text-sm transition-colors duration-120 ease-standard disabled:cursor-progress ${
                    chosen
                      ? "bg-action-tint font-semibold text-action-hover ring-1 ring-inset ring-action"
                      : "enabled:hover:bg-action-tint enabled:active:bg-action-tint"
                  }`}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
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
