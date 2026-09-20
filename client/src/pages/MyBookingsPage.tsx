import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useMyBookings, useShop } from "../api/queries.ts";
import type { Booking } from "../api/types.ts";
import { BookingCard } from "../booking/BookingCard.tsx";
import { CancelDialog } from "../booking/CancelDialog.tsx";
import { PastVisits } from "../booking/PastVisits.tsx";
import { RescheduleDialog } from "../booking/RescheduleDialog.tsx";
import { ButtonLink } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { firstName } from "../lib/format.ts";

type OpenDialog = { kind: "cancel" | "reschedule"; booking: Booking } | null;

const DEFAULT_FREE_CANCELLATION_HOURS = 24;

const describe = (booking: Booking) =>
  `${formatLongDate(booking.localDate)} at ${booking.localTime} with ${firstName(booking.barber.name)}`;

function ArrivalNotice({ bookings }: { bookings: Booking[] }) {
  const location = useLocation();
  const [params] = useSearchParams();

  const paidId = params.get("paid");
  const unpaidId = params.get("unpaid");
  const bookedId: unknown = location.state?.bookedId;
  const booking = bookings.find((entry) => [paidId, unpaidId, bookedId].includes(entry.id));
  if (!booking) {
    return null;
  }

  if (booking.status === "confirmed") {
    return <Notice className="mb-8">You are booked for {describe(booking)}. See you then.</Notice>;
  }
  if (booking.status !== "pending") {
    return null;
  }
  if (booking.id === paidId) {
    return (
      <Notice className="mb-8">
        Thank you. We are confirming your payment; this page will update by itself in a
        moment.
      </Notice>
    );
  }
  return (
    <Notice className="mb-8">
      Your booking for {describe(booking)} isn't confirmed yet, because the deposit hasn't been
      paid.
      {booking.heldUntilLocalTime &&
        ` We are holding the time until ${booking.heldUntilLocalTime}.`}
    </Notice>
  );
}

export function MyBookingsPage() {
  const [params] = useSearchParams();
  const bookings = useMyBookings(params.get("paid"));
  const shop = useShop();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const freeCancellationHours =
    shop.data?.freeCancellationHours ?? DEFAULT_FREE_CANCELLATION_HOURS;

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
                    freeCancellationHours={freeCancellationHours}
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
            <PastVisits bookings={past} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <title>My bookings · Dalaki</title>
      <h1 className="mb-8 text-4xl">My bookings</h1>

      {bookings.data && <ArrivalNotice bookings={bookings.data.upcoming} />}

      {renderLists()}

      {dialog?.kind === "cancel" && (
        <CancelDialog
          booking={dialog.booking}
          freeCancellationHours={freeCancellationHours}
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
