import { NavLink, Outlet } from "react-router";

const TAB =
  "-mb-px whitespace-nowrap border-b-2 border-transparent pb-3 text-sm font-medium text-muted hover:text-cream aria-[current=page]:border-brass aria-[current=page]:text-cream";

// The frame around the four admin pages: a title and a row of tabs.
export function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-4xl">Admin</h1>
      <nav
        aria-label="Admin sections"
        className="mt-6 flex gap-6 overflow-x-auto border-b border-line"
      >
        {/* `end` stops Overview from also matching /admin/bookings. */}
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
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}
