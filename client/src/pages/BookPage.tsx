import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useAvailability, useBarbers, useServices, useShop } from "../api/queries.ts";
import { ChoiceList } from "../booking/ChoiceList.tsx";
import { ConfirmStep } from "../booking/ConfirmStep.tsx";
import { SlotPicker } from "../booking/SlotPicker.tsx";
import { type Step, Stepper } from "../booking/Stepper.tsx";
import { describeWorkingDays } from "../booking/workingDays.ts";
import { DisplayPrice } from "../components/DisplayPrice.tsx";
import { Notice } from "../components/Notice.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { dayParts, isShopDate } from "../lib/dates.ts";
import { firstName, formatDuration } from "../lib/format.ts";

const STEP_TITLES = [
  "Choose a service",
  "Choose your barber",
  "Pick a day and time",
  "Confirm your booking",
];

export function BookPage() {
  const [params, setParams] = useSearchParams();
  const shop = useShop();
  const services = useServices();
  const barbers = useBarbers();

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
      <div className="space-y-8">
        <Stepper current={step} steps={steps} />

        <section aria-labelledby="step-title" className="space-y-5">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
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
                    <DisplayPrice cents={entry.priceCents} className="block text-xl text-brass-light" />
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
                workingWeekdays={new Set(barber.workingHours.map((hours) => hours.weekday))}
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
              />
            ) : (
              <LoadingBlock label="Checking that the time is still free" rows={2} />
            ))}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <title>Book an appointment · Dalaki</title>
      <h1
        className={
          step === 1
            ? "mb-8 text-4xl"
            : "mb-5 font-sans text-sm font-semibold uppercase tracking-widest text-muted sm:mb-8 sm:font-display sm:text-4xl sm:font-normal sm:normal-case sm:tracking-normal sm:text-cream"
        }
      >
        Book an appointment
      </h1>
      {renderBody()}
    </div>
  );
}
