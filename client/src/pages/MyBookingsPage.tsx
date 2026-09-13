import { useState } from "react";
import { useLocation } from "react-router";
import { useMyBookings, useShop } from "../api/queries.ts";
import type { Booking } from "../api/types.ts";
import { BookingCard } from "../booking/BookingCard.tsx";
import { CancelDialog } from "../booking/CancelDialog.tsx";
import { RescheduleDialog } from "../booking/RescheduleDialog.tsx";
import { ButtonLink } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { firstName } from "../lib/format.ts";

type OpenDialog = { kind: "cancel" | "reschedule"; booking: Booking } | null;

export function MyBookingsPage() {
  const bookings = useMyBookings();
  const shop = useShop();
  const location = useLocation();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  // Set by the booking flow when it sends the customer here after booking.
  const bookedId: unknown = location.state?.bookedId;
  const justBooked = bookings.data?.upcoming.find((booking) => booking.id === bookedId);

  function renderLists() {
    if (bookings.isPending) {
      return <LoadingBlock label="Loading your bookings" />;
    }
    if (bookings.isError) {
      return (
        <ErrorState
          title="We couldn't load your bookings"
          error={bookings.error}
          onRetry={() => void bookings.refetch()}
        />
      );
    }

    const { upcoming, past } = bookings.data;
    return (
      <div className="space-y-12">
        <section aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="mb-4 text-2xl">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing booked"
              action={<ButtonLink to="/book">Book an appointment</ButtonLink>}
            >
              When you book a visit it will appear here, where you can move or cancel it.
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {upcoming.map((booking) => (
                <li key={booking.id}>
                  <BookingCard
                    booking={booking}
                    onCancel={() => setDialog({ kind: "cancel", booking })}
                    onReschedule={() => setDialog({ kind: "reschedule", booking })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="past-title">
          <h2 id="past-title" className="mb-4 text-2xl">
            Past
          </h2>
          {past.length === 0 ? (
            <EmptyState title="No past visits yet" />
          ) : (
            <ul className="space-y-4">
              {past.map((booking) => (
                <li key={booking.id}>
                  <BookingCard booking={booking} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <title>My bookings · Dalaki</title>
      <h1 className="mb-8 text-4xl">My bookings</h1>

      {justBooked && (
        <Notice className="mb-8">
          You are booked for {formatLongDate(justBooked.localDate)} at {justBooked.localTime}{" "}
          with {firstName(justBooked.barber.name)}. See you then.
        </Notice>
      )}

      {renderLists()}

      {dialog?.kind === "cancel" && (
        <CancelDialog
          booking={dialog.booking}
          // The rule is 24 hours; the fallback only matters if /shop failed.
          freeCancellationHours={shop.data?.freeCancellationHours ?? 24}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "reschedule" &&
        (shop.data ? (
          <RescheduleDialog
            booking={dialog.booking}
            shop={shop.data}
            onClose={() => setDialog(null)}
          />
        ) : null)}
    </div>
  );
}
