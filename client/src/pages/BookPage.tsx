import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useAvailability, useBarbers, useServices, useShop } from "../api/queries.ts";
import { BookingSummary } from "../booking/BookingSummary.tsx";
import { ChoiceList } from "../booking/ChoiceList.tsx";
import { ConfirmStep } from "../booking/ConfirmStep.tsx";
import { SlotPicker } from "../booking/SlotPicker.tsx";
import { type Step, Stepper } from "../booking/Stepper.tsx";
import { describeWorkingDays } from "../booking/workingDays.ts";
import { Notice } from "../components/Notice.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { dayParts, isShopDate } from "../lib/dates.ts";
import { firstName, formatDuration, formatPrice } from "../lib/format.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";

const STEP_TITLES = [
  "Choose a service",
  "Choose your barber",
  "Pick a day and time",
  "Confirm your booking",
];

const SUMMARY_FITS_BESIDE = "(min-width: 64rem)";

export function BookPage() {
  const [params, setParams] = useSearchParams();
  const shop = useShop();
  const services = useServices();
  const barbers = useBarbers();
  const summaryBeside = useMediaQuery(SUMMARY_FITS_BESIDE);

  const service = services.data?.find((entry) => entry.id === params.get("service"));
  const barber = barbers.data?.find((entry) => entry.id === params.get("barber"));
  const dateParam = params.get("date");
  const date = isShopDate(dateParam) ? dateParam : null;
  const time = params.get("time");

  const requestedStep = !service ? 1 : !barber ? 2 : !(date && time) ? 3 : 4;

  const availability = useAvailability(
    requestedStep === 4 && service && barber && date
      ? { barberId: barber.id, serviceId: service.id, date }
      : null,
  );
  const slot = availability.data?.slots.find((entry) => entry.startsAt === time);
  const slotWasTaken = requestedStep === 4 && availability.isSuccess && !slot;
  const step = slotWasTaken ? 3 : requestedStep;

  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  function update(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setParams(next, { replace });
  }

  function renderBody() {
    const failed = [shop, services, barbers].find((query) => query.isError);
    if (failed) {
      return (
        <ErrorState
          title="We couldn't load the booking form"
          error={failed.error}
          onRetry={() => {
            void shop.refetch();
            void services.refetch();
            void barbers.refetch();
          }}
        />
      );
    }
    if (!shop.data || !services.data || !barbers.data) {
      return <LoadingBlock label="Loading the booking form" />;
    }
    if (services.data.length === 0 || barbers.data.length === 0) {
      return (
        <EmptyState title="Online booking is closed for now">
          Call us on {shop.data.phone} and we will find you a time.
        </EmptyState>
      );
    }

    const chosenDay = date && slot && step === 4 ? dayParts(date) : null;
    const steps: Step[] = [
      {
        label: "Service",
        choice: service && step > 1 ? service.name : undefined,
        onChange: () => update({ service: null, time: null }),
      },
      {
        label: "Barber",
        choice: barber && step > 2 ? firstName(barber.name) : undefined,
        onChange: () => update({ barber: null, date: null, time: null }),
      },
      {
        label: "Time",
        choice:
          chosenDay && slot
            ? `${chosenDay.weekday} ${chosenDay.day} ${chosenDay.month}, ${slot.localTime}`
            : undefined,
        onChange: () => update({ time: null }),
      },
      { label: "Confirm" },
    ];

    return (
      <>
        <Stepper current={step} steps={steps} />

        <div className="mt-7 lg:mt-11 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-14">
          <section aria-labelledby="step-title" className="space-y-5">
            <h2
              id="step-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl outline-none lg:text-3xl"
            >
              {STEP_TITLES[step - 1]}
            </h2>

            {step === 1 && (
              <ChoiceList
                onChoose={(id) => update({ service: id })}
                choices={services.data.map((entry) => ({
                  id: entry.id,
                  title: entry.name,
                  description: entry.description,
                  aside: (
                    <>
                      <span className="block text-xl font-extrabold tabular-nums text-action">
                        {formatPrice(entry.priceCents)}
                      </span>
                      <span className="block text-muted">
                        {formatDuration(entry.durationMinutes)}
                      </span>
                    </>
                  ),
                }))}
              />
            )}

            {step === 2 && (
              <ChoiceList
                onChoose={(id) => update({ barber: id })}
                choices={barbers.data.map((entry) => ({
                  id: entry.id,
                  title: entry.name,
                  description: entry.bio,
                  aside: (
                    <span className="text-muted">{describeWorkingDays(entry.workingHours)}</span>
                  ),
                }))}
              />
            )}

            {step === 3 && service && barber && (
              <>
                {slotWasTaken && (
                  <Notice tone="error">
                    That time has just been taken. These are the times still free.
                  </Notice>
                )}
                <SlotPicker
                  shop={shop.data}
                  barberId={barber.id}
                  serviceId={service.id}
                  workingHours={barber.workingHours}
                  date={date}
                  selectedStartsAt={null}
                  onDateChange={(day) => update({ date: day, time: null }, true)}
                  onSlotSelect={(day, chosen) => update({ date: day, time: chosen.startsAt })}
                />
              </>
            )}

            {step === 4 &&
              service &&
              barber &&
              date &&
              (availability.isError ? (
                <ErrorState
                  title="We couldn't check that time"
                  error={availability.error}
                  onRetry={() => void availability.refetch()}
                />
              ) : slot ? (
                <ConfirmStep
                  shop={shop.data}
                  service={service}
                  barber={barber}
                  date={date}
                  slot={slot}
                  showSummary={!summaryBeside}
                />
              ) : (
                <LoadingBlock label="Checking that the time is still free" rows={2} />
              ))}
          </section>

          {summaryBeside && (
            <aside aria-label="Your booking so far" className="sticky top-6">
              <BookingSummary
                service={service}
                barber={barber}
                date={date}
                slot={step === 4 ? slot : undefined}
              />
            </aside>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-8 lg:pt-12">
      <title>Book an appointment · Dalaki</title>
      <div className="max-w-2xl lg:max-w-none">
        <h1 className="mb-3 text-sm font-semibold tracking-normal text-muted lg:mb-4 lg:text-base">
          Book an appointment
        </h1>
        {renderBody()}
      </div>
    </div>
  );
}
