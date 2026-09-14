import type { Role } from "../api/types.ts";

// Login and register send the user on to ?next=... afterwards. The value
// comes from the URL, so it is only followed if it is a path inside this
// app. Otherwise a crafted link could bounce a visitor to another site.
// Returns null when there is nothing safe to follow.
export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

// Where someone lands after logging in when no page asked for the login.
export function homeFor(role: Role): string {
  return role === "barber" ? "/barber" : "/bookings";
}

export function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}
