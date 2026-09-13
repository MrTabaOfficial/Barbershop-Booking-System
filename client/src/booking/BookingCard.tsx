import type { Booking } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";

type BookingCardProps = {
  booking: Booking;
  // Left out for past bookings, which can't be changed.
  onCancel?: () => void;
  onReschedule?: () => void;
};

export function BookingCard({ booking, onCancel, onReschedule }: BookingCardProps) {
  // The server refuses changes to anything else; don't offer them.
  const canChange = booking.status === "pending" || booking.status === "confirmed";

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
        <StatusBadge status={booking.status} />
      </div>

      <p className="mt-4 text-sm text-muted">
        {formatPrice(booking.priceCents)}, including a {formatPrice(booking.depositCents)}{" "}
        deposit
      </p>

      {booking.status === "cancelled" && booking.cancelledInFreeWindow !== null && (
        <p className="mt-2 text-sm text-muted">
          {booking.cancelledInFreeWindow
            ? "Cancelled in time, free of charge."
            : "Cancelled late, so the deposit was kept."}
        </p>
      )}

      {canChange && (onCancel || onReschedule) && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {onReschedule && (
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
