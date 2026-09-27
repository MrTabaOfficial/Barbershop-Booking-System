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
  onCancelled: () => void;
};

export function CancelDialog({
  booking,
  freeCancellationHours,
  onClose,
  onCancelled,
}: CancelDialogProps) {
  const cancelBooking = useCancelBooking();
  const deposit = formatPrice(booking.depositCents);

  const hoursUntilStart = (Date.parse(booking.startsAt) - Date.now()) / HOUR_MS;
  const isFree = hoursUntilStart >= freeCancellationHours;

  const consequence =
    booking.paymentStatus !== "paid"
      ? "You haven't paid anything for this booking, so cancelling costs nothing."
      : isFree
        ? `Your appointment is more than ${freeCancellationHours} hours away, so your ${deposit} deposit will be refunded to the card you paid with.`
        : `Your appointment starts in less than ${freeCancellationHours} hours, so the ${deposit} deposit will be kept.`;

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
            onClick={() =>
              cancelBooking.mutate(booking.id, {
                onSuccess: () => {
                  onCancelled();
                  onClose();
                },
              })
            }
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
        Cancelling {freeCancellationHours} hours or more before the appointment refunds the
        deposit. After that the deposit is kept.
      </p>
      <Notice>{consequence}</Notice>
      {cancelBooking.isError && <Notice tone="error">{errorMessage(cancelBooking.error)}</Notice>}
    </Dialog>
  );
}
