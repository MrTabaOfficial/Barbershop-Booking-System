import type { ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthContext.ts";
import { LoginForm, RegisterForm } from "../auth/AuthForms.tsx";
import { Card } from "../components/Card.tsx";
import { Notice } from "../components/Notice.tsx";
import { safeNextPath, withNext } from "../lib/nextPath.ts";

const TEXT_LINK = "font-medium text-brass-light underline underline-offset-4 hover:text-cream";

// The frame shared by the login and register pages. It also does the
// "send them back where they came from" part for both: as soon as there is
// a logged-in user, it navigates to ?next=.
function AuthPage({
  title,
  children,
  switchTo,
}: {
  title: string;
  children: ReactNode;
  switchTo: { question: string; label: string; path: string };
}) {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));

  if (status === "authenticated") {
    return <Navigate to={next} replace />;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <title>{`${title} · Dalaki`}</title>
      <h1 className="mb-6 text-4xl">{title}</h1>
      {next.startsWith("/book") && (
        <Notice className="mb-6">
          Your booking is waiting. You will go straight back to it to confirm.
        </Notice>
      )}
      <Card>{children}</Card>
      <p className="mt-6 text-sm text-muted">
        {switchTo.question}{" "}
        {/* Keep ?next= when switching between the two forms. */}
        <Link to={withNext(switchTo.path, next)} className={TEXT_LINK}>
          {switchTo.label}
        </Link>
      </p>
    </div>
  );
}

export function LoginPage() {
  return (
    <AuthPage
      title="Log in"
      switchTo={{ question: "New to Dalaki?", label: "Create an account", path: "/register" }}
    >
      <LoginForm />
    </AuthPage>
  );
}

export function RegisterPage() {
  return (
    <AuthPage
      title="Create an account"
      switchTo={{ question: "Already have an account?", label: "Log in", path: "/login" }}
    >
      <RegisterForm />
    </AuthPage>
  );
}
