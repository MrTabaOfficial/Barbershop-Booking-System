import type { ReactNode } from "react";

type Tone = "info" | "success" | "error";

const TONES: Record<Tone, string> = {
  info: "border-action bg-action-tint text-ink",
  success: "border-success bg-success-tint text-ink",
  error: "border-danger bg-danger-tint font-semibold text-danger-strong",
};

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
      className={`rounded-md border px-4 py-3 text-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
