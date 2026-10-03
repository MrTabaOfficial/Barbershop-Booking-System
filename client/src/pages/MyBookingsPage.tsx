import { useRef, useState } from "react";
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
import { t } from "../i18n/index.ts";
import { formatLongDate } from "../lib/dates.ts";
import { firstName } from "../lib/format.ts";
import { useFocusAfter } from "../lib/useFocusAfter.ts";

type OpenDialog = { kind: "cancel" | "reschedule"; booking: Booking } | null;

const DEFAULT_FREE_CANCELLATION_HOURS = 24;

const cardId = (bookingId: string) => `booking-${bookingId}`;

const describe = (booking: Booking) =>
  t("my.bookedWhen", {
    date: formatLongDate(booking.localDate),
    time: booking.localTime,
    barber: firstName(booking.barber.name),
  });

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
    return (
      <Notice tone="success" className="mb-8">
        {t("my.booked", { when: describe(booking) })}
      </Notice>
    );
  }
  if (booking.status !== "pending") {
    return null;
  }
  if (booking.id === paidId) {
    return <Notice className="mb-8">{t("my.confirming")}</Notice>;
  }
  return <Notice className="mb-8">{t("my.payToConfirm")}</Notice>;
}

export function MyBookingsPage() {
  const [params] = useSearchParams();
  const bookings = useMyBookings(params.get("paid"));
  const shop = useShop();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const upcomingHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterCancelling = useFocusAfter<string>(
    (bookingId) =>
      !bookings.data?.upcoming.some(
        (booking) =>
          booking.id === bookingId && (booking.status === "pending" || booking.status === "confirmed"),
      ),
    (bookingId) => document.getElementById(cardId(bookingId)) ?? upcomingHeading.current,
  );
  const freeCancellationHours =
    shop.data?.freeCancellationHours ?? DEFAULT_FREE_CANCELLATION_HOURS;

  function renderLists() {
    if (bookings.isPending) {
      return <LoadingBlock label={t("my.loading")} />;
    }
    if (bookings.isError) {
      return (
        <ErrorState
          title={t("my.loadError")}
          error={bookings.error}
          onRetry={() => void bookings.refetch()}
        />
      );
    }

    const { upcoming, past } = bookings.data;
    return (
      <div className="space-y-10">
        <section aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" ref={upcomingHeading} tabIndex={-1} className="mb-3 text-xl">
            {t("my.upcoming")}
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title={t("my.nothing")}
              action={<ButtonLink to="/book">{t("home.book")}</ButtonLink>}
            >
              {t("my.nothingHint")}
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {upcoming.map((booking) => (
                <li key={booking.id} id={cardId(booking.id)} tabIndex={-1} className="rounded-lg">
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
          <h2 id="past-title" className="mb-3 text-xl">
            {t("my.past")}
          </h2>
          {past.length === 0 ? (
            <EmptyState title={t("my.noPast")} />
          ) : (
            <PastVisits bookings={past} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <title>{t("my.title")}</title>
      <h1 className="mb-6 text-3xl">{t("my.heading")}</h1>

      {bookings.data && <ArrivalNotice bookings={bookings.data.upcoming} />}

      {renderLists()}

      {dialog?.kind === "cancel" && (
        <CancelDialog
          booking={dialog.booking}
          freeCancellationHours={freeCancellationHours}
          onClose={() => setDialog(null)}
          onCancelled={() => focusAfterCancelling(dialog.booking.id)}
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
