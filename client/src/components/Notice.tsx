import type { ReactNode } from "react";

type Tone = "info" | "error";

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-danger bg-danger-tint font-semibold text-danger-strong"
          : "border-action bg-action-tint text-ink"
      } ${className}`}
    >
      {children}
    </div>
  );
}
