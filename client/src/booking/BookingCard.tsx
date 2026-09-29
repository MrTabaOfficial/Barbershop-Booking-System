import type { Booking } from "../api/types.ts";
import { Button, buttonClasses } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
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
  switch (booking.paymentStatus) {
    case "refunded":
      return `Your ${formatPrice(booking.depositCents)} deposit was refunded.`;
    case "paid":
      return `The ${formatPrice(booking.depositCents)} deposit was kept.`;
    case "refund_failed":
      return "Your deposit is due back to you but the refund didn't go through. Please call us and we will sort it out.";
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
        {booking.service.name} with {booking.barber.name}
      </p>

      <p className="mt-3 text-sm text-muted">
        {formatPrice(booking.priceCents)}, including a {formatPrice(booking.depositCents)}{" "}
        deposit
      </p>

      {awaitingPayment && (
        <p className="mt-2 text-sm">
          This booking isn't confirmed until the deposit is paid.
          {booking.heldUntilLocalTime &&
            ` We are holding the time until ${booking.heldUntilLocalTime}.`}
        </p>
      )}
      {cancellationNote && <p className="mt-2 text-sm text-muted">{cancellationNote}</p>}
      {confirmed && onReschedule && !canStillMove && (
        <p className="mt-2 text-sm text-muted">
          With less than {freeCancellationHours} hours to go, this booking can no longer be
          moved.
        </p>
      )}

      {(awaitingPayment || confirmed) && (onCancel || onReschedule) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {awaitingPayment && booking.paymentUrl && (
            <a href={booking.paymentUrl} className={buttonClasses({})}>
              Pay the deposit
            </a>
          )}
          {confirmed && onReschedule && canStillMove && (
            <Button variant="secondary" onClick={onReschedule}>
              Move booking
            </Button>
          )}
          {onCancel && (
            <Button variant="quiet-danger" onClick={onCancel}>
              Cancel booking
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
