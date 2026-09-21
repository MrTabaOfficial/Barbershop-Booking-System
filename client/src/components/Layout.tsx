import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from "react-router";
import { useShop } from "../api/queries.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { brand } from "../brand.ts";
import { phoneLink } from "../lib/format.ts";

const NAV_LINK =
  "whitespace-nowrap py-2 text-sm font-semibold underline-offset-4 sm:text-base transition-colors duration-120 ease-standard hover:text-action aria-[current=page]:underline aria-[current=page]:decoration-2";

const NAV_PLATE =
  "rounded-md border-2 border-ink px-3 py-1.5 text-sm font-semibold sm:px-4 sm:text-base transition-colors duration-120 ease-standard hover:border-action hover:bg-action-tint hover:text-action-hover aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-on-action";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label={`${brand.name}, home`}>
      <span
        lang="ka"
        className="rounded-md bg-action px-2.5 pb-2.5 pt-2 text-base font-semibold leading-none text-on-action sm:px-3 sm:text-lg"
      >
        {brand.wordmark}
      </span>
      <span className="hidden text-lg font-semibold sm:inline">{brand.name}</span>
    </Link>
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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8 lg:py-5">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-3.5 sm:gap-5">
          {status === "authenticated" && (
            <>
              {!isBarber && !isAdmin && (
                <NavLink to="/bookings" className={NAV_LINK}>
                  My bookings
                </NavLink>
              )}
              <button type="button" className={NAV_LINK} onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
          {status === "anonymous" && (
            <NavLink to="/login" className={NAV_LINK}>
              Log in
            </NavLink>
          )}
          {isBarber ? (
            <NavLink to="/barber" className={NAV_PLATE}>
              Schedule
            </NavLink>
          ) : isAdmin ? (
            <NavLink to="/admin" className={NAV_PLATE}>
              Admin
            </NavLink>
          ) : (
            <NavLink to="/book" className={NAV_PLATE}>
              Book
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
    <footer className="mt-20 border-t-2 border-ink">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-muted sm:px-8">
        <p className="font-semibold text-ink">{brand.name}</p>
        {shop.data && (
          <>
            <p>
              {shop.data.address.street}, {shop.data.address.district}, {shop.data.address.city}
            </p>
            <p>
              <a href={phoneLink(shop.data.phone)} className="underline-offset-4 hover:underline">
                {shop.data.phone}
              </a>
            </p>
          </>
        )}
        <p className="pt-3">
          A portfolio project. The shop, its address and its phone number are fictional.
        </p>
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
        Skip to content
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
