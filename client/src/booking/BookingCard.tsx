import type { Booking } from "../api/types.ts";
import { Button, buttonClasses } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { t } from "../i18n/index.ts";
import { formatLongDate } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";

const HOUR_MS = 60 * 60 * 1000;

type BookingCardProps = {
  booking: Booking;
  freeCancellationHours: number;
  onCancel?: () => void;
  onReschedule?: () => void;
};

export function describeCancellation(booking: Booking): string | null {
  const deposit = formatPrice(booking.depositCents);
  switch (booking.paymentStatus) {
    case "refunded":
      return t("card.refunded", { deposit });
    case "paid":
      return t("card.kept", { deposit });
    case "refund_failed":
      return t("card.refundFailed");
    default:
      return null;
  }
}

export function BookingCard({
  booking,
  freeCancellationHours,
  onCancel,
  onReschedule,
}: BookingCardProps) {
  const awaitingPayment = booking.status === "pending";
  const confirmed = booking.status === "confirmed";

  const hoursUntilStart = (Date.parse(booking.startsAt) - Date.now()) / HOUR_MS;
  const canStillMove = hoursUntilStart >= freeCancellationHours;
  const cancellationNote = booking.status === "cancelled" ? describeCancellation(booking) : null;

  return (
    <Card>
      <StatusBadge status={booking.status} audience="customer" />
      <p className="mt-2 text-lg font-semibold">
        {formatLongDate(booking.localDate)}, {booking.localTime}
      </p>
      <p className="text-muted">
        {t("common.with", { service: booking.service.name, barber: booking.barber.name })}
      </p>

      <p className="mt-3 text-sm text-muted">
        {t("card.price", {
          price: formatPrice(booking.priceCents),
          deposit: formatPrice(booking.depositCents),
        })}
      </p>

      {awaitingPayment && (
        <p className="mt-2 text-sm">
          {t("card.unpaid")}
          {booking.heldUntilLocalTime &&
            ` ${t("card.heldUntil", { time: booking.heldUntilLocalTime })}`}
        </p>
      )}
      {cancellationNote && <p className="mt-2 text-sm text-muted">{cancellationNote}</p>}
      {confirmed && onReschedule && !canStillMove && (
        <p className="mt-2 text-sm text-muted">
          {t("card.cannotMove", { hours: freeCancellationHours })}
        </p>
      )}

      {(awaitingPayment || confirmed) && (onCancel || onReschedule) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {awaitingPayment && booking.paymentUrl && (
            <a href={booking.paymentUrl} className={buttonClasses({})}>
              {t("card.pay")}
            </a>
          )}
          {confirmed && onReschedule && canStillMove && (
            <Button variant="secondary" onClick={onReschedule}>
              {t("card.move")}
            </Button>
          )}
          {onCancel && (
            <Button variant="quiet-danger" onClick={onCancel}>
              {t("card.cancel")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
