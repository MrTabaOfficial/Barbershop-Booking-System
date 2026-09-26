import { NavLink, Outlet } from "react-router";

const TAB =
  "-mb-px whitespace-nowrap border-b-4 border-transparent pb-2.5 font-semibold text-muted transition-colors duration-120 ease-standard hover:text-ink aria-[current=page]:border-action aria-[current=page]:font-extrabold aria-[current=page]:text-ink lg:text-xl";

export function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-8 lg:pt-10">
      <nav
        aria-label="Admin sections"
        className="flex gap-5 overflow-x-auto border-b border-line lg:gap-8"
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
      <div className="mt-6 lg:mt-8">
        <Outlet />
      </div>
    </div>
  );
}
