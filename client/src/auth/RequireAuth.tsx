import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import type { Role } from "../api/types.ts";
import { ButtonLink } from "../components/Button.tsx";
import { LoadingBlock } from "../components/States.tsx";
import { withNext } from "../lib/nextPath.ts";
import { useAuth } from "./AuthContext.ts";

// This guard only decides what the browser shows; it protects nothing,
// because the API checks the role on every request.
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <LoadingBlock label="Checking your session" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to={withNext("/login", location.pathname + location.search)} replace />;
  }
  if (role && user.role !== role) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <title>Not available · Dalaki</title>
        <h1 className="text-4xl">This page isn't for your account</h1>
        <p className="mt-4 text-muted">
          You are logged in as {user.name}, and this part of the site is for {role}s.
        </p>
        <ButtonLink to="/" className="mt-8">
          Back to the home page
        </ButtonLink>
      </div>
    );
  }
  return children;
}
