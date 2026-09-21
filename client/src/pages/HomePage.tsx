import type { ReactNode } from "react";
import { Link } from "react-router";
import { useBarbers, useServices, useShop } from "../api/queries.ts";
import { describeWorkingDays, shopOpeningHours } from "../booking/workingDays.ts";
import { ButtonLink } from "../components/Button.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { weekdayOf } from "../lib/dates.ts";
import { brand } from "../brand.ts";
import {
  firstName,
  formatClock,
  formatDuration,
  formatPrice,
  phoneLink,
} from "../lib/format.ts";

const TEXT_LINK =
  "font-semibold text-action underline decoration-2 underline-offset-4 transition-colors duration-120 ease-standard hover:text-action-pressed";

const HANGER =
  "relative mr-7 mt-[18px] flex items-baseline gap-2.5 rounded-md border-2 border-ink bg-surface px-4 pb-2 pt-1.5 text-sm before:absolute before:bottom-full before:left-5 before:h-5 before:w-0.5 before:bg-ink after:absolute after:bottom-full after:right-5 after:h-5 after:w-0.5 after:bg-ink lg:mr-12 lg:px-5 lg:text-base";

function OpenToday() {
  const barbers = useBarbers();
  const shop = useShop();

  if (barbers.isError || shop.isError) {
    return null;
  }
  if (!barbers.data || !shop.data) {
    return (
      <p aria-hidden="true" className={HANGER}>
        <span className="text-muted">Open today</span>
        <span className="invisible font-semibold tabular-nums">00:00 to 00:00</span>
      </p>
    );
  }

  const today = weekdayOf(shop.data.today);
  const hours = shopOpeningHours(barbers.data).find((day) => day.weekday === today)?.hours;
  return hours ? (
    <p className={HANGER}>
      <span className="text-muted">Open today</span>
      <span className="font-semibold tabular-nums">
        {formatClock(hours.opens)} to {formatClock(hours.closes)}
      </span>
    </p>
  ) : (
    <p className={HANGER}>
      <span className="text-muted">Today</span>
      <span className="font-semibold text-danger">Closed</span>
    </p>
  );
}

function ShopSign() {
  const shop = useShop();
  return (
    <div className="flex w-full flex-col items-end sm:max-w-md lg:order-2 lg:max-w-none">
      <div
        aria-hidden="true"
        className="relative w-full rounded-[22px] bg-action px-5 pb-6 pt-7 text-center text-on-action before:absolute before:inset-[9px] before:rounded-[14px] before:border-2 before:border-on-action lg:rounded-[28px] lg:pb-10 lg:pt-12 lg:before:inset-3 lg:before:rounded-[18px]"
      >
        <p
          lang="ka"
          className="whitespace-nowrap text-[17.5vw] font-extrabold leading-none sm:text-[5rem] lg:text-[4.625rem]"
        >
          {brand.wordmark}
        </p>
        <p className="mt-2.5 text-sm font-semibold lg:mt-4">
          Barbershop{shop.data && `, ${shop.data.address.street}`}
        </p>
      </div>
      <OpenToday />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-5xl gap-7 px-4 pb-12 pt-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-12 lg:pb-24 lg:pt-16">
      <ShopSign />
      <div>
        <h1 className="text-balance text-3xl lg:text-5xl">
          A proper haircut, in an unhurried chair.
        </h1>
        <p className="mt-4 max-w-xl text-muted lg:mt-6 lg:text-lg">
          {brand.name} is a small barbershop on Asatiani Street in Sololaki. Classic cuts, beard
          work and hot towel shaves, by appointment, so the chair is yours when you walk in.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 lg:mt-8">
          <ButtonLink to="/book" size="lg">
            Book an appointment
          </ButtonLink>
          <a href="#services" className={`${TEXT_LINK} py-2 text-center`}>
            See services and prices
          </a>
        </div>
      </div>
    </section>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-4 border-t-2 border-ink py-12 lg:py-20"
    >
      <h2 id={`${id}-title`} className="text-2xl lg:text-3xl">
        {title}
      </h2>
      {intro && <p className="mt-3 max-w-2xl text-muted">{intro}</p>}
      <div className="mt-6 lg:mt-8">{children}</div>
    </section>
  );
}

function Services() {
  const services = useServices();
  const shop = useShop();

  if (services.isPending) {
    return <LoadingBlock label="Loading services" rows={4} />;
  }
  if (services.isError) {
    return (
      <ErrorState
        title="We couldn't load the services"
        error={services.error}
        onRetry={() => void services.refetch()}
      />
    );
  }
  if (services.data.length === 0) {
    return (
      <EmptyState title="The price list is being updated">
        {shop.data ? `Call us on ${shop.data.phone}` : "Call us"} and we will tell you what is on
        offer.
      </EmptyState>
    );
  }

  return (
    <ul className="border-t border-line">
      {services.data.map((service) => (
        <li key={service.id}>
          <Link
            to={`/book?service=${service.id}`}
            className="group block border-b border-line py-4"
          >
            <span className="flex items-baseline gap-2.5">
              <span className="text-lg font-extrabold transition-colors duration-120 ease-standard group-hover:text-action">
                <span className="sr-only">Book </span>
                {service.name}
              </span>
              <span
                aria-hidden="true"
                className="flex-1 -translate-y-1 border-b-2 border-dotted border-edge/55"
              />
              <span className="text-xl font-extrabold tabular-nums text-action">
                {formatPrice(service.priceCents)}
              </span>
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {formatDuration(service.durationMinutes)}
              {service.description && `. ${service.description}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Barbers() {
  const barbers = useBarbers();

  if (barbers.isPending) {
    return <LoadingBlock label="Loading barbers" />;
  }
  if (barbers.isError) {
    return (
      <ErrorState
        title="We couldn't load the barbers"
        error={barbers.error}
        onRetry={() => void barbers.refetch()}
      />
    );
  }
  if (barbers.data.length === 0) {
    return <EmptyState title="No barbers are taking bookings right now" />;
  }

  return (
    <ul className="grid gap-9 sm:grid-cols-3 sm:gap-8">
      {barbers.data.map((barber) => (
        <li key={barber.id}>
          <h3 className="text-xl">{barber.name}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            {describeWorkingDays(barber.workingHours)}
          </p>
          {barber.bio && <p className="mt-3 text-sm">{barber.bio}</p>}
          <Link to={`/book?barber=${barber.id}`} className={`${TEXT_LINK} mt-2 inline-block py-2`}>
            Book with {firstName(barber.name)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Address() {
  const shop = useShop();

  if (shop.isPending) {
    return <LoadingBlock label="Loading the address" rows={2} />;
  }
  if (shop.isError) {
    return (
      <ErrorState
        title="We couldn't load the address"
        error={shop.error}
        onRetry={() => void shop.refetch()}
      />
    );
  }

  const { address, directions, phone } = shop.data;
  return (
    <address className="space-y-1 not-italic">
      <p>{address.street}</p>
      <p>
        {address.district}, {address.city}
      </p>
      <p className="pt-2 text-sm text-muted">{directions}</p>
      <p className="pt-2">
        <a href={phoneLink(phone)} className={TEXT_LINK}>
          {phone}
        </a>
      </p>
    </address>
  );
}

function OpeningHours() {
  const barbers = useBarbers();
  const shopInfo = useShop();

  if (barbers.isPending) {
    return <LoadingBlock label="Loading opening hours" rows={2} />;
  }
  if (barbers.isError) {
    return (
      <ErrorState
        title="We couldn't load the opening hours"
        error={barbers.error}
        onRetry={() => void barbers.refetch()}
      />
    );
  }

  const today = shopInfo.data ? weekdayOf(shopInfo.data.today) : null;
  return (
    <dl className="border-t border-line">
      {shopOpeningHours(barbers.data).map((day) => (
        <div
          key={day.weekday}
          className={`flex justify-between gap-4 border-b border-line py-2.5 ${day.weekday === today ? "font-semibold" : ""}`}
        >
          <dt>
            {day.name}
            {day.weekday === today && (
              <span className="ml-2 rounded-sm bg-action-tint px-1.5 py-0.5 text-xs text-action-hover">
                Today
              </span>
            )}
          </dt>
          <dd className="tabular-nums">
            {day.hours
              ? `${formatClock(day.hours.opens)} to ${formatClock(day.hours.closes)}`
              : "Closed"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HomePage() {
  return (
    <>
      <title>Dalaki · Barbershop in Tbilisi</title>
      <Hero />
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        <Section
          id="services"
          title="What we do, and what it costs"
          intro="The price on this list is the price you pay. Pick a service to book it."
        >
          <Services />
        </Section>

        <Section
          id="barbers"
          title="The people holding the scissors"
          intro="Book with whoever suits you. If you can't decide, take any chair: we'll tell you if a colleague is the better fit."
        >
          <Barbers />
        </Section>

        <Section id="visit" title="Hours and where to find us">
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-12">
            <div>
              <h3 className="mb-3 text-lg">Opening hours</h3>
              <OpeningHours />
            </div>
            <div>
              <h3 className="mb-3 text-lg">Address</h3>
              <Address />
              <ButtonLink to="/book" className="mt-7">
                Book an appointment
              </ButtonLink>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
