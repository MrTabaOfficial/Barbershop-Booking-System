import type { ReactNode } from "react";
import { Link } from "react-router";
import { useBarbers, useServices, useShop } from "../api/queries.ts";
import { describeWorkingDays, shopOpeningHours } from "../booking/workingDays.ts";
import { ButtonLink, TEXT_LINK } from "../components/Button.tsx";
import { Tag } from "../components/Tag.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { t } from "../i18n/index.ts";
import { weekdayOf } from "../lib/dates.ts";
import {
  firstName,
  formatClock,
  formatDuration,
  formatPrice,
  phoneLink,
} from "../lib/format.ts";

type PhotoName = "interior" | "fade" | "tools" | "chair" | "scissors" | "shave" | "finished" | "bulbs";

function OpenToday() {
  const barbers = useBarbers();
  const shop = useShop();

  if (barbers.isError || shop.isError) {
    return null;
  }
  if (!barbers.data || !shop.data) {
    return (
      <p aria-hidden="true" className="invisible mt-4 text-lg">
        {t("home.openToday")} 00:00
      </p>
    );
  }

  const today = weekdayOf(shop.data.today);
  const hours = shopOpeningHours(barbers.data).find((day) => day.weekday === today)?.hours;
  return hours ? (
    <p className="mt-4 text-lg text-muted">
      {t("home.openToday")}{" "}
      <span className="text-ink tabular-nums">
        {t("common.range", { from: formatClock(hours.opens), to: formatClock(hours.closes) })}
      </span>
    </p>
  ) : (
    <p className="mt-4 text-lg text-muted">{t("home.closedToday")}</p>
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
        alt={t("photo.window")}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_60%]"
      />
      {/* The page colour rising into the photograph, so the words sit on the dark street, not on the lit window. */}
      <div className="bg-linear-to-t from-page via-page/75 via-40% to-transparent px-4 pb-8 pt-40 sm:px-8 lg:px-10 lg:pb-12">
        <h1 className="max-w-[18ch] text-balance text-3xl lg:text-5xl">{t("home.heading")}</h1>
        <OpenToday />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 lg:mt-8">
          <ButtonLink to="/book" size="lg">
            {t("home.book")}
          </ButtonLink>
          <a href="#services" className={`${TEXT_LINK} inline-flex min-h-11 items-center justify-center`}>
            {t("home.seePrices")}
          </a>
        </div>
      </div>
    </section>
  );
}

function Photo({
  name,
  position = "object-[50%_40%]",
  band = false,
  className = "",
}: {
  name: PhotoName;
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
        alt={t(`photo.${name}`)}
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
    return <LoadingBlock label={t("home.services.loading")} rows={4} />;
  }
  if (services.isError) {
    return (
      <ErrorState
        title={t("home.services.loadError")}
        error={services.error}
        onRetry={() => void services.refetch()}
      />
    );
  }
  if (services.data.length === 0) {
    return (
      <EmptyState title={t("home.services.empty")}>
        {t("home.services.emptyHint", {
          call: shop.data ? t("common.callUsOn", { phone: shop.data.phone }) : t("common.callUs"),
        })}
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
                <span className="sr-only">{t("home.services.bookPrefix")} </span>
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
    return <LoadingBlock label={t("home.barbers.loading")} />;
  }
  if (barbers.isError) {
    return (
      <ErrorState
        title={t("home.barbers.loadError")}
        error={barbers.error}
        onRetry={() => void barbers.refetch()}
      />
    );
  }
  if (barbers.data.length === 0) {
    return <EmptyState title={t("home.barbers.empty")} />;
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
            {t("home.barbers.bookWith", { name: firstName(barber.name) })}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Address() {
  const shop = useShop();

  if (shop.isPending) {
    return <LoadingBlock label={t("home.visit.addressLoading")} rows={2} />;
  }
  if (shop.isError) {
    return (
      <ErrorState
        title={t("home.visit.addressError")}
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
    return <LoadingBlock label={t("home.visit.hoursLoading")} rows={2} />;
  }
  if (barbers.isError) {
    return (
      <ErrorState
        title={t("home.visit.hoursError")}
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
            {day.weekday === today && <Tag className="ml-2">{t("common.today")}</Tag>}
          </dt>
          <dd className="whitespace-nowrap tabular-nums">
            {day.hours
              ? t("common.range", {
                  from: formatClock(day.hours.opens),
                  to: formatClock(day.hours.closes),
                })
              : t("common.closed")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HomePage() {
  return (
    <>
      <title>{t("home.title")}</title>
      <Hero />
      <div className="grid gap-2.5 p-2.5 sm:grid-cols-2 lg:auto-rows-[minmax(17.5rem,auto)] lg:grid-cols-12 lg:gap-3 lg:p-3">
        <Photo name="interior" className="lg:col-span-8" />
        <Cell
          id="services"
          title={t("home.services.title")}
          intro={t("home.services.intro")}
          className="lg:col-span-4"
        >
          <Services />
        </Cell>

        <Photo name="fade" position="object-[70%_40%]" className="lg:col-span-3" />
        <Cell
          id="barbers"
          title={t("home.barbers.title")}
          intro={t("home.barbers.intro")}
          className="lg:col-span-5"
        >
          <Barbers />
        </Cell>
        <Photo name="tools" className="lg:col-span-4" />

        <Photo name="chair" className="lg:col-span-7" />
        <Cell id="visit" title={t("home.visit.title")} className="lg:col-span-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-base font-semibold">{t("home.visit.hours")}</h3>
              <OpeningHours />
            </div>
            <div>
              <h3 className="mb-2 text-base font-semibold">{t("home.visit.address")}</h3>
              <Address />
              <ButtonLink to="/book" variant="secondary" className="mt-4">
                {t("home.book")}
              </ButtonLink>
            </div>
          </div>
        </Cell>

        <Photo name="scissors" className="lg:col-span-4" />
        <Photo name="shave" className="lg:col-span-4" />
        <Photo name="finished" className="lg:col-span-4" />

        <Photo name="bulbs" position="object-[50%_55%]" band />
      </div>
    </>
  );
}
