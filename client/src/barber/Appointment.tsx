import { errorMessage } from "../api/http.ts";
import { type Outcome, useRecordOutcome } from "../api/barberQueries.ts";
import type { ScheduleBooking } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { Notice } from "../components/Notice.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";

// One appointment on the barber's schedule: who, when, what, how to reach
// them, and, once it has started, how it went.
export function Appointment({ booking }: { booking: ScheduleBooking }) {
  const recordOutcome = useRecordOutcome();

  // Both are instants, so this is right in any time zone. The server makes
  // the same check; this only decides whether to show the buttons.
  // An unpaid booking isn't confirmed, so it can't have an outcome.
  const hasStarted = Date.parse(booking.startsAt) <= Date.now() && booking.status !== "pending";

  function record(outcome: Outcome, alreadyRecorded: boolean) {
    if (!alreadyRecorded) {
      recordOutcome.mutate({ bookingId: booking.id, outcome });
    }
  }

  const completed = booking.status === "completed";
  const noShow = booking.status === "no_show";

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl tabular-nums">
            {booking.localTime} to {booking.localEndTime}
          </p>
          <p className="mt-1 font-semibold">{booking.customer.name}</p>
          <p className="text-sm text-muted">{booking.service.name}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {booking.customer.phone ? (
        <a
          href={`tel:${booking.customer.phone.replaceAll(" ", "")}`}
          className="mt-2 inline-flex min-h-11 items-center font-medium text-brass-light underline underline-offset-4 hover:text-cream"
        >
          Call {booking.customer.phone}
        </a>
      ) : (
        <p className="mt-3 text-sm text-muted">No phone number on file</p>
      )}

      {hasStarted && (
        // The outcome can be changed afterwards, so a mis-tap is fixable:
        // the recorded one is highlighted and the other stays available.
        <div role="group" aria-label="How did it go?" className="mt-3 grid grid-cols-2 gap-3">
          <Button
            variant={completed ? "primary" : "secondary"}
            aria-pressed={completed}
            disabled={recordOutcome.isPending}
            onClick={() => record("complete", completed)}
          >
            Completed
          </Button>
          <Button
            variant={noShow ? "primary" : "secondary"}
            aria-pressed={noShow}
            disabled={recordOutcome.isPending}
            onClick={() => record("no-show", noShow)}
          >
            No-show
          </Button>
        </div>
      )}

      {recordOutcome.isError && (
        <Notice tone="error" className="mt-3">
          {errorMessage(recordOutcome.error)}
        </Notice>
      )}
    </Card>
  );
}
