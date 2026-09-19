import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from "react-router";
import { useShop } from "../api/queries.ts";
import { useAuth } from "../auth/AuthContext.ts";
import { brand } from "../brand.ts";
import { phoneLink } from "../lib/format.ts";

const NAV_LINK =
  "py-2 text-sm font-medium text-muted hover:text-cream aria-[current=page]:text-brass-light";

function Logo() {
  return (
    <Link to="/" className="flex items-baseline gap-3" aria-label={`${brand.name}, home`}>
      <span lang="ka" className="font-georgian text-2xl font-semibold text-brass-light">
        {brand.wordmark}
      </span>
      <span className="hidden text-xs font-semibold uppercase tracking-[0.3em] text-muted sm:inline">
        {brand.name}
      </span>
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
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6">
          {isBarber ? (
            <NavLink to="/barber" className={NAV_LINK}>
              Schedule
            </NavLink>
          ) : isAdmin ? (
            <NavLink to="/admin" className={NAV_LINK}>
              Admin
            </NavLink>
          ) : (
            <NavLink to="/book" className={NAV_LINK}>
              Book
            </NavLink>
          )}
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
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const shop = useShop();
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-muted sm:px-6">
        <p>
          {brand.name}
          {shop.data && (
            <>
              {" "}
              · {shop.data.address.street}, {shop.data.address.district}, {shop.data.address.city} ·{" "}
              <a href={phoneLink(shop.data.phone)} className="hover:text-cream">
                {shop.data.phone}
              </a>
            </>
          )}
        </p>
        <p>A portfolio project. The shop, its address and its phone number are fictional.</p>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-sm focus:bg-brass focus:px-4 focus:py-2 focus:text-ink"
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
