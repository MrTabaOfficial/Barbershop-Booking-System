import type { BookingStatus } from "../api/types.ts";
import { t, type TranslationKey } from "../i18n/index.ts";
import { Tag, type TagTone } from "./Tag.tsx";

const STAFF_LABELS: Record<BookingStatus, TranslationKey> = {
  pending: "status.pending",
  confirmed: "status.confirmed",
  completed: "status.completed",
  cancelled: "status.cancelled",
  no_show: "status.noShow",
  expired: "status.expired",
};

const CUSTOMER_LABELS: Record<BookingStatus, TranslationKey> = {
  ...STAFF_LABELS,
  pending: "status.awaitingPayment",
  no_show: "status.missed",
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
  return t((audience === "customer" ? CUSTOMER_LABELS : STAFF_LABELS)[status]);
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
