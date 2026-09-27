import type { ReactNode } from "react";

export type TagTone = "action" | "warning" | "success" | "danger" | "neutral";

const TONES: Record<TagTone, string> = {
  action: "bg-action-tint text-action-hover",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  neutral: "bg-sunken text-muted",
};

export function Tag({
  tone = "action",
  className = "",
  children,
}: {
  tone?: TagTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
