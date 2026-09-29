import type { ReactNode } from "react";
import { errorMessage } from "../api/http.ts";
import { Button } from "./Button.tsx";

export function LoadingBlock({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-16 rounded-md bg-sunken motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-sunken px-5 py-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "We couldn't load this",
  error,
  onRetry,
}: {
  title?: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-danger bg-danger-tint px-5 py-6 text-ink">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm">{errorMessage(error)}</p>
      <Button variant="secondary" className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
