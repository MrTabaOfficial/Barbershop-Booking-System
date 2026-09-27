import type { BookingStatus } from "../api/types.ts";
import { Tag, type TagTone } from "./Tag.tsx";

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

const TONES: Record<BookingStatus, TagTone> = {
  pending: "warning",
  confirmed: "action",
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
  expired: "neutral",
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
  return <Tag tone={TONES[status]}>{statusLabel(status, audience)}</Tag>;
}
