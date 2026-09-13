const DEFAULT_PATH = "/bookings";

// Login and register send the user on to ?next=... afterwards. The value
// comes from the URL, so it is only followed if it is a path inside this
// app. Otherwise a crafted link could bounce a visitor to another site.
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_PATH;
  }
  return next;
}

export function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}
