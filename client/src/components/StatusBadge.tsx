import type { BookingStatus } from "../api/types.ts";

const LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const isLive = status === "pending" || status === "confirmed";
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
        isLive ? "border-brass text-brass-light" : "border-line-strong text-muted"
      }`}
    >
      {LABELS[status]}
    </span>
  );
}
