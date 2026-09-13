import type { ReactNode } from "react";

type Tone = "info" | "error";

// A short message about something that just happened. Errors interrupt a
// screen reader ("alert"); other notices wait their turn ("status").
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
      className={`border-l-2 bg-surface px-4 py-3 text-sm leading-relaxed ${
        tone === "error" ? "border-danger text-danger" : "border-brass text-cream"
      } ${className}`}
    >
      {children}
    </div>
  );
}
