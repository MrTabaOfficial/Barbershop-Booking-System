import { useLocation, useNavigate } from "react-router";
import { errorMessage } from "../api/http.ts";
import { useCreateBooking } from "../api/queries.ts";
import type { Barber, Service, Shop, Slot } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { Button, ButtonLink } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { Notice } from "../components/Notice.tsx";
import { formatDuration, formatPrice } from "../lib/format.ts";
import { withNext } from "../lib/nextPath.ts";

type ConfirmStepProps = {
  shop: Shop;
  service: Service;
  barber: Barber;
  slot: Slot;
};

export function ConfirmStep({ shop, service, barber, slot }: ConfirmStepProps) {
  const { status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const createBooking = useCreateBooking();

  // Where login and register send the customer back to: this exact step,
  // with every choice still in the URL.
  const thisStep = location.pathname + location.search;

  function confirm() {
    createBooking.mutate(
      { barberId: barber.id, serviceId: service.id, startsAt: slot.startsAt },
      { onSuccess: (booking) => navigate("/bookings", { state: { bookedId: booking.id } }) },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <dl className="space-y-3">
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
          You can cancel free of charge until {shop.freeCancellationHours} hours before the
          appointment. After that the deposit is kept.
        </p>
      </Card>

      {createBooking.isError && <Notice tone="error">{errorMessage(createBooking.error)}</Notice>}

      {status === "authenticated" ? (
        <Button
          size="lg"
          className="w-full"
          loading={createBooking.isPending}
          loadingLabel="Booking…"
          onClick={confirm}
        >
          Confirm booking
        </Button>
      ) : status === "loading" ? (
        <Button size="lg" className="w-full" disabled>
          Checking your session…
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Log in to confirm. Your choices are kept and you will come straight back here.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink size="lg" className="flex-1" to={withNext("/login", thisStep)}>
              Log in to confirm
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
