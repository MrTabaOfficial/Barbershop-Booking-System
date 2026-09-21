import { useLocation, useNavigate } from "react-router";
import { errorMessage } from "../api/http.ts";
import { useCreateBooking } from "../api/queries.ts";
import type { Barber, Service, Shop, Slot } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { Button, ButtonLink } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import { formatLongDate, shopClockOf } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";
import { withNext } from "../lib/nextPath.ts";
import { BookingSummary } from "./BookingSummary.tsx";

const HOUR_MS = 60 * 60 * 1000;

type ConfirmStepProps = {
  shop: Shop;
  service: Service;
  barber: Barber;
  date: string;
  slot: Slot;
  showSummary: boolean;
};

function describeRules(shop: Shop, service: Service, slot: Slot): string[] {
  const hasDeposit = service.depositCents > 0;
  const deadline = new Date(Date.parse(slot.startsAt) - shop.freeCancellationHours * HOUR_MS);
  const lastFreeMoment = shopClockOf(deadline, shop.timeZone);

  const payment = hasDeposit
    ? `Pay ${formatPrice(service.depositCents)} now by card and ${formatPrice(service.priceCents - service.depositCents)} at the shop.`
    : `Pay ${formatPrice(service.priceCents)} at the shop.`;
  const changes =
    deadline.getTime() > Date.now()
      ? `Cancel or move it free until ${formatLongDate(lastFreeMoment.date)} at ${lastFreeMoment.time}.${hasDeposit ? " After that the deposit is kept." : ""}`
      : `This appointment is less than ${shop.freeCancellationHours} hours away, so it can't be moved${hasDeposit ? " and the deposit is kept if you cancel" : ""}.`;

  return hasDeposit
    ? [payment, changes, "We hold this time for 30 minutes while you pay."]
    : [payment, changes];
}

export function ConfirmStep({ shop, service, barber, date, slot, showSummary }: ConfirmStepProps) {
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
    <div className="space-y-5">
      {showSummary && (
        <BookingSummary compact service={service} barber={barber} date={date} slot={slot} />
      )}

      <ul className="space-y-1.5 text-sm lg:text-base">
        {describeRules(shop, service, slot).map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

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
            Your choices are kept. You'll come straight back here after logging in.
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
