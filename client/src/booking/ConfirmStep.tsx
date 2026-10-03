import { useLocation, useNavigate } from "react-router";
import { errorMessage } from "../api/http.ts";
import { useCreateBooking } from "../api/queries.ts";
import type { Barber, Service, Shop, Slot } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { Button, ButtonLink } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import { t } from "../i18n/index.ts";
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
    ? t("confirm.payDeposit", {
        deposit: formatPrice(service.depositCents),
        rest: formatPrice(service.priceCents - service.depositCents),
      })
    : t("confirm.payAtShop", { price: formatPrice(service.priceCents) });
  const changes =
    deadline.getTime() > Date.now()
      ? [
          t("confirm.freeUntil", {
            date: formatLongDate(lastFreeMoment.date),
            time: lastFreeMoment.time,
          }),
          hasDeposit ? t("confirm.depositKeptAfter") : "",
        ]
          .filter(Boolean)
          .join(" ")
      : t(hasDeposit ? "confirm.tooCloseKept" : "confirm.tooClose", {
          hours: shop.freeCancellationHours,
        });

  return hasDeposit ? [payment, changes, t("confirm.hold")] : [payment, changes];
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
          loadingLabel={t(hasDeposit ? "confirm.goingToPayment" : "confirm.booking")}
          onClick={confirm}
        >
          {t(hasDeposit ? "confirm.continueToPayment" : "confirm.confirmBooking")}
        </Button>
      ) : status === "loading" ? (
        <Button size="lg" className="w-full" disabled>
          {t("confirm.checkingSession")}
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("confirm.keptChoices")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink size="lg" className="flex-1" to={withNext("/login", thisStep)}>
              {t("confirm.logIn")}
            </ButtonLink>
            <ButtonLink
              size="lg"
              variant="secondary"
              className="flex-1"
              to={withNext("/register", thisStep)}
            >
              {t("confirm.createAccount")}
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
