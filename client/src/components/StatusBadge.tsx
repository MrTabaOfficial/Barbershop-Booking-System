import type { BookingStatus } from "../api/types.ts";

const STAFF_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

// "No-show" is the shop's word for it. A customer reading their own
// history is told, more gently, that they missed the appointment.
const CUSTOMER_LABELS: Record<BookingStatus, string> = {
  ...STAFF_LABELS,
  no_show: "Missed",
};

export function statusLabel(status: BookingStatus, audience: "staff" | "customer" = "staff") {
  return (audience === "customer" ? CUSTOMER_LABELS : STAFF_LABELS)[status];
}

export function StatusBadge({
  status,
  audience = "staff",
}: {
  status: BookingStatus;
  audience?: "staff" | "customer";
}) {
  const isLive = status === "pending" || status === "confirmed";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
        isLive ? "border-brass text-brass-light" : "border-line-strong text-muted"
      }`}
    >
      {statusLabel(status, audience)}
    </span>
  );
}
