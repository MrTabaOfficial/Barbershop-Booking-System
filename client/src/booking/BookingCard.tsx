import type { Booking } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";

const HOUR_MS = 60 * 60 * 1000;

const PAY_LINK =
  "inline-flex min-h-11 items-center justify-center rounded-sm bg-brass px-5 py-2 text-center text-sm font-semibold text-ink transition-colors hover:bg-brass-light";

type BookingCardProps = {
  booking: Booking;
  // How long before the start a booking can still be moved for free.
  freeCancellationHours: number;
  // Left out for past bookings, which can't be changed.
  onCancel?: () => void;
  onReschedule?: () => void;
};

// What happened to the deposit of a cancelled booking, in the customer's terms.
function describeCancellation(booking: Booking): string | null {
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

  // The server applies the same rule; this only decides what to offer.
  const hoursUntilStart = (Date.parse(booking.startsAt) - Date.now()) / HOUR_MS;
  const canStillMove = hoursUntilStart >= freeCancellationHours;
  const cancellationNote = booking.status === "cancelled" ? describeCancellation(booking) : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl">
            {formatLongDate(booking.localDate)}, {booking.localTime}
          </p>
          <p className="mt-1 text-muted">
            {booking.service.name} with {booking.barber.name}
          </p>
        </div>
        <StatusBadge status={booking.status} audience="customer" />
      </div>

      <p className="mt-4 text-sm text-muted">
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
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {/* A plain link: the payment page is on another site. */}
          {awaitingPayment && booking.paymentUrl && (
            <a href={booking.paymentUrl} className={PAY_LINK}>
              Pay the deposit
            </a>
          )}
          {confirmed && onReschedule && canStillMove && (
            <Button variant="secondary" onClick={onReschedule}>
              Reschedule
            </Button>
          )}
          {onCancel && (
            <Button variant="danger" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
