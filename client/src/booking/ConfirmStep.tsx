import { useLocation, useNavigate } from "react-router";
import { errorMessage } from "../api/http.ts";
import { useCreateBooking } from "../api/queries.ts";
import type { Barber, Service, Shop, Slot } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { Button, ButtonLink } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { Notice } from "../components/Notice.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { formatDuration, formatPrice } from "../lib/format.ts";
import { withNext } from "../lib/nextPath.ts";

type ConfirmStepProps = {
  shop: Shop;
  service: Service;
  barber: Barber;
  date: string;
  slot: Slot;
};

export function ConfirmStep({ shop, service, barber, date, slot }: ConfirmStepProps) {
  const { status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const createBooking = useCreateBooking();

  const thisStep = location.pathname + location.search;

  const hasDeposit = service.depositCents > 0;

  function confirm() {
    createBooking.mutate(
      { barberId: barber.id, serviceId: service.id, startsAt: slot.startsAt },
      {
        onSuccess: ({ booking, checkoutUrl }) => {
          if (checkoutUrl) {
            window.location.assign(checkoutUrl);
          } else {
            navigate("/bookings", { state: { bookedId: booking.id } });
          }
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="font-display text-xl">
          {formatLongDate(date)} at {slot.localTime}
        </p>
        <p className="mt-1 text-muted">
          {service.name} with {barber.name}
        </p>
        <dl className="mt-5 space-y-3 border-t border-line pt-4">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Length</dt>
            <dd>{formatDuration(service.durationMinutes)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Price</dt>
            <dd>{formatPrice(service.priceCents)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3">
            <dt className="text-muted">Deposit, part of the price</dt>
            <dd className="font-semibold text-brass-light">{formatPrice(service.depositCents)}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          {hasDeposit
            ? "You pay the deposit now, by card, and the rest at the shop. We hold the time for 30 minutes while you pay. "
            : ""}
          You can cancel or move the booking until {shop.freeCancellationHours} hours before
          the appointment{hasDeposit ? " and get the deposit back. After that it is kept." : "."}
        </p>
      </Card>

      {createBooking.isError && <Notice tone="error">{errorMessage(createBooking.error)}</Notice>}

      {status === "authenticated" ? (
        <Button
          size="lg"
          className="w-full"
          // The button keeps loading after success, while the browser leaves
          // for the payment page, so that a second click can't book a second
          // slot.
          loading={createBooking.isPending || createBooking.isSuccess}
          loadingLabel={hasDeposit ? "Taking you to the payment page…" : "Booking…"}
          onClick={confirm}
        >
          {hasDeposit ? "Continue to payment" : "Confirm booking"}
        </Button>
      ) : status === "loading" ? (
        <Button size="lg" className="w-full" disabled>
          Checking your session…
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Log in to continue. Your choices are kept and you will come straight back here.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink size="lg" className="flex-1" to={withNext("/login", thisStep)}>
              Log in to continue
            </ButtonLink>
            <ButtonLink
              size="lg"
              variant="secondary"
              className="flex-1"
              to={withNext("/register", thisStep)}
            >
              Create an account
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
