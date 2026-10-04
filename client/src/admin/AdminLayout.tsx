import { NavLink, Outlet } from "react-router";
import { t } from "../i18n/index.ts";

const TAB =
  "whitespace-nowrap border-b-4 border-transparent px-1.5 pb-2.5 pt-1 font-semibold text-muted focus-visible:-outline-offset-2 transition-colors duration-120 ease-standard hover:text-ink aria-[current=page]:border-action aria-[current=page]:font-semibold aria-[current=page]:text-ink lg:text-xl";

export function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-2.5 pb-16 pt-5 sm:px-3 lg:pt-8">
      <nav
        aria-label={t("admin.sections")}
        className="flex gap-2 overflow-x-auto px-0.5 sm:px-1.5 lg:gap-5"
      >
        <NavLink to="/admin" end className={TAB}>
          {t("admin.overview")}
        </NavLink>
        <NavLink to="/admin/bookings" className={TAB}>
          {t("admin.bookings")}
        </NavLink>
        <NavLink to="/admin/services" className={TAB}>
          {t("admin.services")}
        </NavLink>
        <NavLink to="/admin/staff" className={TAB}>
          {t("admin.staff")}
        </NavLink>
      </nav>
      <div className="border-t border-line pt-4 lg:pt-5">
        <Outlet />
      </div>
    </div>
  );
}
