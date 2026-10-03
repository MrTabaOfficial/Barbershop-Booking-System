import { errorMessage } from "../api/http.ts";
import { useCancelBooking } from "../api/queries.ts";
import type { Booking } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Notice } from "../components/Notice.tsx";
import { t } from "../i18n/index.ts";
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
  const hours = freeCancellationHours;

  const hoursUntilStart = (Date.parse(booking.startsAt) - Date.now()) / HOUR_MS;
  const isFree = hoursUntilStart >= freeCancellationHours;

  const consequence =
    booking.paymentStatus !== "paid"
      ? t("cancel.nothingPaid")
      : isFree
        ? t("cancel.willRefund", { hours, deposit })
        : t("cancel.willKeep", { hours, deposit });

  return (
    <Dialog
      title={t("cancel.title")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel.keep")}
          </Button>
          <Button
            variant="danger"
            loading={cancelBooking.isPending}
            loadingLabel={t("cancel.cancelling")}
            onClick={() =>
              cancelBooking.mutate(booking.id, {
                onSuccess: () => {
                  onCancelled();
                  onClose();
                },
              })
            }
          >
            {t("cancel.confirm")}
          </Button>
        </>
      }
    >
      <p>
        {t("cancel.what", {
          service: booking.service.name,
          barber: booking.barber.name,
          date: formatLongDate(booking.localDate),
          time: booking.localTime,
        })}
      </p>
      <p className="text-muted">{t("cancel.rule", { hours })}</p>
      <Notice>{consequence}</Notice>
      {cancelBooking.isError && <Notice tone="error">{errorMessage(cancelBooking.error)}</Notice>}
    </Dialog>
  );
}
