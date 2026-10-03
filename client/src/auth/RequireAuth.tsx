import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import type { Role } from "../api/types.ts";
import { ButtonLink } from "../components/Button.tsx";
import { LoadingBlock } from "../components/States.tsx";
import { t } from "../i18n/index.ts";
import { withNext } from "../lib/nextPath.ts";
import { useAuth } from "./AuthContext.ts";

// This guard only decides what the browser shows; it protects nothing,
// because the API checks the role on every request.
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
        <LoadingBlock label={t("auth.checking")} />
      </div>
    );
  }
  if (!user) {
    return <Navigate to={withNext("/login", location.pathname + location.search)} replace />;
  }
  if (role && user.role !== role) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-8">
        <title>{t("auth.notYours.title")}</title>
        <h1 className="text-3xl">{t("auth.notYours")}</h1>
        <p className="mt-4 text-muted">
          {t(role === "barber" ? "auth.forBarbers" : "auth.forAdmins", { name: user.name })}
        </p>
        <ButtonLink to="/" className="mt-8">
          {t("auth.backHome")}
        </ButtonLink>
      </div>
    );
  }
  return children;
}
