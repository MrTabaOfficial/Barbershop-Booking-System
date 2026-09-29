import type { ReactNode } from "react";
import { Link } from "react-router";
import { useBarbers, useServices, useShop } from "../api/queries.ts";
import { describeWorkingDays, shopOpeningHours } from "../booking/workingDays.ts";
import { ButtonLink, TEXT_LINK } from "../components/Button.tsx";
import { Tag } from "../components/Tag.tsx";
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

function OpenToday() {
  const barbers = useBarbers();
  const shop = useShop();

  if (barbers.isError || shop.isError) {
    return null;
  }
  if (!barbers.data || !shop.data) {
    return (
      <p aria-hidden="true" className="invisible mt-4 text-lg">
        Open today 00:00 to 00:00
      </p>
    );
  }

  const today = weekdayOf(shop.data.today);
  const hours = shopOpeningHours(barbers.data).find((day) => day.weekday === today)?.hours;
  return hours ? (
    <p className="mt-4 text-lg text-muted">
      Open today{" "}
      <span className="text-ink tabular-nums">
        {formatClock(hours.opens)} to {formatClock(hours.closes)}
      </span>
    </p>
  ) : (
    <p className="mt-4 text-lg text-muted">Closed today</p>
  );
}

function Hero() {
  return (
    <section className="relative isolate flex min-h-[72svh] flex-col justify-end lg:min-h-[86svh]">
      <img
        src="/photos/window-night.webp"
        width={1600}
        height={807}
        fetchPriority="high"
        alt="The shop front at night, every window lit."
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_60%]"
      />
      {/* The page colour rising into the photograph, so the words sit on the dark street, not on the lit window. */}
      <div className="bg-linear-to-t from-page via-page/75 via-40% to-transparent px-4 pb-8 pt-40 sm:px-8 lg:px-10 lg:pb-12">
        <h1 className="max-w-[18ch] text-balance text-3xl lg:text-5xl">
          A proper haircut, in an unhurried chair.
        </h1>
        <OpenToday />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 lg:mt-8">
          <ButtonLink to="/book" size="lg">
            Book an appointment
          </ButtonLink>
          <a href="#services" className={`${TEXT_LINK} inline-flex min-h-11 items-center justify-center`}>
            See services and prices
          </a>
        </div>
      </div>
    </section>
  );
}

function Photo({
  name,
  alt,
  position = "object-[50%_40%]",
  band = false,
  className = "",
}: {
  name: string;
  alt: string;
  position?: string;
  band?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-surface ${
        band ? "aspect-video sm:col-span-2 lg:col-span-12" : "aspect-4/3 lg:aspect-auto lg:row-span-2"
      } ${className}`}
    >
      {/* Absolute, so a tall photograph can never set the height of its row. */}
      <img
        src={`/photos/${name}.webp`}
        alt={alt}
        loading="lazy"
        className={`absolute inset-0 h-full w-full object-cover ${position}`}
      />
    </div>
  );
}

function Cell({
  id,
  title,
  intro,
  children,
  className = "",
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`flex scroll-mt-4 flex-col gap-5 rounded-lg bg-surface p-5 sm:col-span-2 sm:p-6 lg:row-span-2 lg:p-8 ${className}`}
    >
      <div>
        <h2 id={`${id}-title`} className="text-xl lg:text-2xl">
          {title}
        </h2>
        {intro && <p className="mt-2 max-w-xl text-muted">{intro}</p>}
      </div>
      {children}
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
    <ul className="border-b border-line">
      {services.data.map((service) => (
        <li key={service.id}>
          <Link
            to={`/book?service=${service.id}`}
            className="group block border-t border-line py-3 transition-colors duration-120 ease-standard hover:text-action-hover"
          >
            <span className="flex items-baseline justify-between gap-4">
              <span className="font-semibold underline decoration-action decoration-1 underline-offset-4">
                <span className="sr-only">Book </span>
                {service.name}
              </span>
              <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                <span className="text-sm text-muted">{formatDuration(service.durationMinutes)}</span>
                <span className="font-semibold text-action">{formatPrice(service.priceCents)}</span>
              </span>
            </span>
            {service.description && (
              <span className="mt-0.5 block text-sm text-muted">{service.description}</span>
            )}
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
    <ul className="space-y-5">
      {barbers.data.map((barber) => (
        <li key={barber.id}>
          <h3 className="text-lg">{barber.name}</h3>
          <p className="text-sm text-muted">{describeWorkingDays(barber.workingHours)}</p>
          {barber.bio && <p className="mt-1 max-w-xl text-sm">{barber.bio}</p>}
          <Link
            to={`/book?barber=${barber.id}`}
            className={`${TEXT_LINK} inline-flex min-h-11 items-center text-sm`}
          >
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
        <a href={phoneLink(phone)} className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
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
          className={`flex justify-between gap-4 border-b border-line py-2 ${day.weekday === today ? "font-semibold" : ""}`}
        >
          <dt>
            {day.name}
            {day.weekday === today && <Tag className="ml-2">Today</Tag>}
          </dt>
          <dd className="whitespace-nowrap tabular-nums">
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
      <title>{`${brand.name} · Barbershop in Tbilisi`}</title>
      <Hero />
      <div className="grid gap-2.5 p-2.5 sm:grid-cols-2 lg:auto-rows-[minmax(17.5rem,auto)] lg:grid-cols-12 lg:gap-3 lg:p-3">
        <Photo
          name="interior"
          alt="Six green leather chairs in a row under hanging lamps, a chequered floor below."
          className="lg:col-span-8"
        />
        <Cell
          id="services"
          title="What we do, and what it costs"
          intro="The price on this list is the price you pay. Pick a service to book it."
          className="lg:col-span-4"
        >
          <Services />
        </Cell>

        <Photo
          name="fade"
          alt="Clippers working up the back of a head, the fade half done."
          position="object-[70%_40%]"
          className="lg:col-span-3"
        />
        <Cell
          id="barbers"
          title="The people holding the scissors"
          intro="Book with whoever suits you. If you can't decide, take any chair: we'll tell you if a colleague is the better fit."
          className="lg:col-span-5"
        >
          <Barbers />
        </Cell>
        <Photo
          name="tools"
          alt="Two pairs of scissors, a comb and a razor laid out on a wooden counter."
          className="lg:col-span-4"
        />

        <Photo
          name="chair"
          alt="A customer in the chair seen from behind, the barber's clippers at his neck."
          className="lg:col-span-7"
        />
        <Cell id="visit" title="Hours and where to find us" className="lg:col-span-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-base font-semibold">Opening hours</h3>
              <OpeningHours />
            </div>
            <div>
              <h3 className="mb-2 text-base font-semibold">Address</h3>
              <Address />
              <ButtonLink to="/book" variant="secondary" className="mt-4">
                Book an appointment
              </ButtonLink>
            </div>
          </div>
        </Cell>

        <Photo
          name="scissors"
          alt="A barber's hands holding comb and scissors against short dark hair."
          className="lg:col-span-4"
        />
        <Photo
          name="shave"
          alt="A straight razor on a lathered cheek, steam rising."
          className="lg:col-span-4"
        />
        <Photo
          name="finished"
          alt="A finished fade seen from behind, the clippers lifting away."
          className="lg:col-span-4"
        />

        <Photo
          name="bulbs"
          alt="Three filament bulbs hanging over the counter, the rest of the room in shadow."
          position="object-[50%_55%]"
          band
        />
      </div>
    </>
  );
}
