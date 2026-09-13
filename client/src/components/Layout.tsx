import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext.ts";
import { shop } from "../shop.ts";

const NAV_LINK =
  "py-2 text-sm font-medium text-muted hover:text-cream aria-[current=page]:text-brass-light";

function Logo() {
  return (
    <Link to="/" className="flex items-baseline gap-3" aria-label={`${shop.name}, home`}>
      <span lang="ka" className="font-georgian text-2xl font-semibold text-brass-light">
        {shop.wordmark}
      </span>
      <span className="hidden text-xs font-semibold uppercase tracking-[0.3em] text-muted sm:inline">
        {shop.name}
      </span>
    </Link>
  );
}

function Header() {
  const { status, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    // Leave first. If the session ended while a protected page was still
    // showing, that page would redirect to the login form instead.
    await navigate("/");
    await logout();
  }

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6">
          <NavLink to="/book" className={NAV_LINK}>
            Book
          </NavLink>
          {status === "authenticated" && (
            <>
              <NavLink to="/bookings" className={NAV_LINK}>
                My bookings
              </NavLink>
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
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-muted sm:px-6">
        <p>
          {shop.name} · {shop.street}, {shop.district}, {shop.city} ·{" "}
          <a href={`tel:${shop.phone.replaceAll(" ", "")}`} className="hover:text-cream">
            {shop.phone}
          </a>
        </p>
        <p>A portfolio project. The shop, its address and its phone number are fictional.</p>
      </div>
    </footer>
  );
}

// The frame around every page.
export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* The first thing a keyboard user reaches: a way past the header. */}
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
