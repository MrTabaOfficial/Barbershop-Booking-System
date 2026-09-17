// A cancelled or expired booking no longer holds its slot: someone else can
// book that time. Every other status does. The database's overlap
// constraint encodes the same rule.
export const RELEASED_STATUSES = ["CANCELLED", "EXPIRED"] as const;

export function holdsSlot(status: string): boolean {
  return !(RELEASED_STATUSES as readonly string[]).includes(status);
}
