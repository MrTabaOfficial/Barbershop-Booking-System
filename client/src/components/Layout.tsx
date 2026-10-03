import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from "react-router";
import { useShop } from "../api/queries.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { brand } from "../brand.ts";
import { LANGUAGES, t } from "../i18n/index.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { buttonClasses } from "./Button.tsx";
import { phoneLink } from "../lib/format.ts";

const NAV_LINK =
  "inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold underline-offset-4 sm:text-base transition-colors duration-120 ease-standard hover:text-action aria-[current=page]:underline aria-[current=page]:decoration-2";

const NAV_BUTTON = `${buttonClasses({ variant: "secondary", size: "sm" })} aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-on-action`;

function Logo() {
  return (
    <Link
      to="/"
      className="flex min-h-11 items-center gap-3"
      aria-label={t("nav.home", { name: t("brand.name") })}
    >
      <span lang="ka" className="font-wordmark text-lg font-semibold leading-none sm:text-xl">
        {brand.wordmark}
      </span>
      <span className="hidden text-lg font-medium sm:inline">{brand.name}</span>
    </Link>
  );
}

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  const other = LANGUAGES.find((entry) => entry.code !== language) ?? LANGUAGES[0];
  if (!other) {
    return null;
  }
  return (
    <button
      type="button"
      lang={other.code}
      aria-label={t("nav.switchLanguage", { language: other.name })}
      className={NAV_LINK}
      onClick={() => setLanguage(other.code)}
    >
      {other.name}
    </button>
  );
}

function Header() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const isBarber = user?.role === "barber";
  const isAdmin = user?.role === "admin";

  async function handleLogout() {
    // Leaving comes first: if the session ended while a protected page was
    // still showing, that page would redirect to the login form instead.
    await navigate("/");
    await logout();
  }

  return (
    <header>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5 sm:px-8 lg:py-5">
        <Logo />
        <nav aria-label="Main" className="ml-auto flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1 sm:gap-x-5">
          <LanguageSwitch />
          {status === "authenticated" && (
            <>
              {!isBarber && !isAdmin && (
                <NavLink to="/bookings" className={NAV_LINK}>
                  {t("nav.myBookings")}
                </NavLink>
              )}
              <button type="button" className={NAV_LINK} onClick={handleLogout}>
                {t("nav.logOut")}
              </button>
            </>
          )}
          {status === "anonymous" && (
            <NavLink to="/login" className={NAV_LINK}>
              {t("nav.logIn")}
            </NavLink>
          )}
          {isBarber ? (
            <NavLink to="/barber" className={NAV_BUTTON}>
              {t("nav.schedule")}
            </NavLink>
          ) : isAdmin ? (
            <NavLink to="/admin" className={NAV_BUTTON}>
              {t("nav.admin")}
            </NavLink>
          ) : (
            <NavLink to="/book" className={NAV_BUTTON}>
              {t("nav.book")}
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const shop = useShop();
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-muted sm:px-8">
        <p className="font-medium text-ink">{t("brand.name")}</p>
        {shop.data && (
          <>
            <p>
              {shop.data.address.street}, {shop.data.address.district}, {shop.data.address.city}
            </p>
            <p>
              <a
                href={phoneLink(shop.data.phone)}
                className="inline-block py-1 underline underline-offset-4 transition-colors duration-120 ease-standard hover:text-ink"
              >
                {shop.data.phone}
              </a>
            </p>
          </>
        )}
        <p className="pt-3">{t("footer.disclaimer")}</p>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-action focus:px-4 focus:py-2 focus:font-semibold focus:text-on-action"
      >
        {t("nav.skip")}
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
