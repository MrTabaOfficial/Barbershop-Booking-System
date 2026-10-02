import { NavLink, Outlet } from "react-router";

const TAB =
  "whitespace-nowrap border-b-4 border-transparent px-1.5 pb-2.5 pt-1 font-semibold text-muted focus-visible:-outline-offset-2 transition-colors duration-120 ease-standard hover:text-ink aria-[current=page]:border-action aria-[current=page]:font-semibold aria-[current=page]:text-ink lg:text-xl";

export function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-2.5 pb-16 pt-5 sm:px-3 lg:pt-8">
      <nav
        aria-label="Admin sections"
        className="flex gap-2 overflow-x-auto px-0.5 sm:px-1.5 lg:gap-5"
      >
        <NavLink to="/admin" end className={TAB}>
          Overview
        </NavLink>
        <NavLink to="/admin/bookings" className={TAB}>
          Bookings
        </NavLink>
        <NavLink to="/admin/services" className={TAB}>
          Services
        </NavLink>
        <NavLink to="/admin/staff" className={TAB}>
          Staff
        </NavLink>
      </nav>
      <div className="border-t border-line pt-4 lg:pt-5">
        <Outlet />
      </div>
    </div>
  );
}
