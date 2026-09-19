import type { ReactNode } from "react";
import { Link } from "react-router";
import { useBarbers, useServices, useShop } from "../api/queries.ts";
import { describeWorkingDays, shopOpeningHours } from "../booking/workingDays.ts";
import { ButtonLink } from "../components/Button.tsx";
import { Card } from "../components/Card.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { weekdayOf } from "../lib/dates.ts";
import { brand } from "../brand.ts";
import { firstName, formatClock, formatDuration, formatPrice, phoneLink } from "../lib/format.ts";

const TEXT_LINK = "font-medium text-brass-light underline underline-offset-4 hover:text-cream";

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-8 border-t border-line py-14 sm:py-20"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brass-light">
        {eyebrow}
      </p>
      <h2 id={`${id}-title`} className="mt-3 text-3xl sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 max-w-2xl leading-relaxed text-muted">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Hero() {
  return (
    <section className="py-16 sm:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brass-light">
        Barbershop · Sololaki, Tbilisi
      </p>
      <p
        lang="ka"
        aria-hidden="true"
        className="mt-6 font-georgian text-6xl font-semibold leading-none text-brass sm:text-8xl"
      >
        {brand.wordmark}
      </p>
      <h1 className="mt-8 max-w-3xl text-4xl leading-tight sm:text-6xl sm:leading-[1.1]">
        A proper haircut, in an unhurried chair.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        {brand.name} is a small barbershop on Asatiani Street. Classic cuts, beard work and hot
        towel shaves, by appointment, so the chair is yours when you walk in.
      </p>
      <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
        <ButtonLink to="/book" size="lg">
          Book an appointment
        </ButtonLink>
        <a href="#services" className={`${TEXT_LINK} py-2 text-center`}>
          See services and prices
        </a>
      </div>
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
    <ul className="divide-y divide-line border-y border-line">
      {services.data.map((service) => (
        <li
          key={service.id}
          className="grid grid-cols-[1fr_auto] items-start gap-x-6 gap-y-2 py-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"
        >
          <div>
            <h3 className="text-xl">{service.name}</h3>
            {service.description && (
              <p className="mt-1 text-sm leading-relaxed text-muted">{service.description}</p>
            )}
          </div>
          <p className="text-right">
            <span className="block font-display text-2xl text-brass-light">
              {formatPrice(service.priceCents)}
            </span>
            <span className="block text-sm text-muted">
              {formatDuration(service.durationMinutes)}
            </span>
          </p>
          <Link
            to={`/book?service=${service.id}`}
            className={`${TEXT_LINK} col-span-2 py-1 text-sm sm:col-span-1`}
            aria-label={`Book ${service.name}`}
          >
            Book
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
    <ul className="grid gap-4 sm:grid-cols-3">
      {barbers.data.map((barber) => (
        <li key={barber.id}>
          <Card className="flex h-full flex-col">
            <h3 className="text-2xl">{barber.name}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">
              {describeWorkingDays(barber.workingHours)}
            </p>
            {barber.bio && <p className="mt-4 flex-1 text-sm leading-relaxed">{barber.bio}</p>}
            <Link to={`/book?barber=${barber.id}`} className={`${TEXT_LINK} mt-5 py-1 text-sm`}>
              Book with {firstName(barber.name)}
            </Link>
          </Card>
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
    <address className="space-y-1 not-italic leading-relaxed">
      <p>{address.street}</p>
      <p>
        {address.district}, {address.city}
      </p>
      <p className="pt-2 text-muted">{directions}</p>
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
    <dl className="divide-y divide-line border-y border-line">
      {shopOpeningHours(barbers.data).map((day) => (
        <div
          key={day.weekday}
          className={`flex justify-between gap-4 py-2.5 ${day.weekday === today ? "text-brass-light" : ""}`}
        >
          <dt>
            {day.name}
            {day.weekday === today && <span className="sr-only"> (today)</span>}
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
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <title>Dalaki · Barbershop in Tbilisi</title>
      <Hero />

      <Section
        id="services"
        eyebrow="Services"
        title="What we do, and what it costs"
        intro="Every visit starts with a short conversation about what you want and ends with a wash and style. The price on this list is the price you pay."
      >
        <Services />
      </Section>

      <Section
        id="barbers"
        eyebrow="The chairs"
        title="The people holding the scissors"
        intro="Book with whoever suits you. If you are not sure, tell us what you have in mind when you arrive and we will say so honestly if someone else is the better fit."
      >
        <Barbers />
      </Section>

      <Section id="visit" eyebrow="Visit" title="Hours and where to find us">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h3 className="mb-4 text-xl">Opening hours</h3>
            <OpeningHours />
          </div>
          <div>
            <h3 className="mb-4 text-xl">Address</h3>
            <Address />
            <ButtonLink to="/book" className="mt-8">
              Book an appointment
            </ButtonLink>
          </div>
        </div>
      </Section>
    </div>
  );
}
