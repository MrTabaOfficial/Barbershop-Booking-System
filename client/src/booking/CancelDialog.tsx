import { errorMessage } from "../api/http.ts";
import { useCancelBooking } from "../api/queries.ts";
import type { Booking } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Notice } from "../components/Notice.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";

const HOUR_MS = 60 * 60 * 1000;

type CancelDialogProps = {
  booking: Booking;
  freeCancellationHours: number;
  onClose: () => void;
};

// Explains the cancellation rule, and which side of it this booking is on,
// before the customer commits.
export function CancelDialog({ booking, freeCancellationHours, onClose }: CancelDialogProps) {
  const cancelBooking = useCancelBooking();

  // Both are instants, so this is right whatever time zone the visitor is in.
  const hoursUntilStart = (Date.parse(booking.startsAt) - Date.now()) / HOUR_MS;
  const isFree = hoursUntilStart >= freeCancellationHours;

  return (
    <Dialog
      title="Cancel this booking?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            loading={cancelBooking.isPending}
            loadingLabel="Cancelling…"
            onClick={() => cancelBooking.mutate(booking.id, { onSuccess: onClose })}
          >
            Cancel booking
          </Button>
        </>
      }
    >
      <p>
        {booking.service.name} with {booking.barber.name} on {formatLongDate(booking.localDate)}{" "}
        at {booking.localTime}.
      </p>
      <p className="text-muted">
        Cancelling is free until {freeCancellationHours} hours before the appointment. After
        that the deposit is kept.
      </p>
      <Notice>
        {isFree
          ? `Your appointment is more than ${freeCancellationHours} hours away, so cancelling now is free.`
          : `Your appointment starts in less than ${freeCancellationHours} hours, so the ${formatPrice(booking.depositCents)} deposit will be kept.`}
      </Notice>
      {cancelBooking.isError && <Notice tone="error">{errorMessage(cancelBooking.error)}</Notice>}
    </Dialog>
  );
}
