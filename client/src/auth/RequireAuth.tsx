import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { LoadingBlock } from "../components/States.tsx";
import { withNext } from "../lib/nextPath.ts";
import { useAuth } from "./AuthContext.ts";

// Wraps a page that needs a logged-in user. Anonymous visitors are sent to
// log in and brought back here afterwards.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  // Wait for the session check, or a logged-in user who reloads the page
  // would be bounced to the login form for a moment.
  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <LoadingBlock label="Checking your session" />
      </div>
    );
  }
  if (status === "anonymous") {
    return <Navigate to={withNext("/login", location.pathname + location.search)} replace />;
  }
  return children;
}
