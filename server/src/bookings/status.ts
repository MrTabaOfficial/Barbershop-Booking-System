// The database's overlap constraint names the same two statuses, so changing
// this list needs a migration as well.
export const RELEASED_STATUSES = ["CANCELLED", "EXPIRED"] as const;

export function holdsSlot(status: string): boolean {
  return !(RELEASED_STATUSES as readonly string[]).includes(status);
}
