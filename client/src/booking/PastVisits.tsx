import { useState } from "react";
import type { Booking } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { t } from "../i18n/index.ts";
import { formatShortDate } from "../lib/dates.ts";
import { describeCancellation } from "./BookingCard.tsx";

const RECENT_VISITS = 5;
const EARLIER_VISITS_PER_CLICK = 20;

export function PastVisits({ bookings }: { bookings: Booking[] }) {
  const [shown, setShown] = useState(RECENT_VISITS);
  const hidden = bookings.length - shown;

  return (
    <>
      <ul className="divide-y divide-line border-y border-line">
        {bookings.slice(0, shown).map((booking) => {
          const cancellationNote =
            booking.status === "cancelled" ? describeCancellation(booking) : null;
          return (
            <li key={booking.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-x-4">
                <p className="tabular-nums">
                  {formatShortDate(booking.localDate)}, {booking.localTime}
                </p>
                <p className="text-sm text-muted sm:text-base">
                  {t("common.with", { service: booking.service.name, barber: booking.barber.name })}
                </p>
                {cancellationNote && (
                  <p className="text-sm text-muted sm:col-start-2">{cancellationNote}</p>
                )}
              </div>
              <StatusBadge status={booking.status} audience="customer" />
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setShown(shown + EARLIER_VISITS_PER_CLICK)}
        >
          {t("past.showEarlier", { count: hidden })}
        </Button>
      )}
    </>
  );
}
