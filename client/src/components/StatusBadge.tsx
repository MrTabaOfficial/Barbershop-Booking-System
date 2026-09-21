import type { BookingStatus } from "../api/types.ts";

const STAFF_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
};

const CUSTOMER_LABELS: Record<BookingStatus, string> = {
  ...STAFF_LABELS,
  pending: "Awaiting payment",
  no_show: "Missed",
};

const TONES: Record<BookingStatus, string> = {
  pending: "bg-warning-tint text-warning",
  confirmed: "bg-action-tint text-action-hover",
  completed: "bg-success-tint text-success",
  no_show: "bg-danger-tint text-danger",
  cancelled: "bg-sunken text-muted",
  expired: "bg-sunken text-muted",
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
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ${TONES[status]}`}
    >
      {statusLabel(status, audience)}
    </span>
  );
}
