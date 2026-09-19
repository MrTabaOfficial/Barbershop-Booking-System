import type { Role } from "../api/types.ts";

// The value comes from the URL, so it is followed only if it is a path inside
// this app; otherwise a crafted link could bounce a visitor to another site.
export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

const HOME: Record<Role, string> = {
  customer: "/bookings",
  barber: "/barber",
  admin: "/admin",
};

export function homeFor(role: Role): string {
  return HOME[role];
}

export function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}
