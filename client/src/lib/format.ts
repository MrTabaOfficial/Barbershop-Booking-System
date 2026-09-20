const NO_BREAK_SPACE = " ";

export const LARI_SIGN = "₾";

export function formatLari(cents: number): string {
  return (cents / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

export function formatPrice(cents: number): string {
  return `${formatLari(cents)}${NO_BREAK_SPACE}${LARI_SIGN}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatClock(minutesAfterMidnight: number): string {
  const hours = Math.floor(minutesAfterMidnight / 60);
  const minutes = minutesAfterMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

// The arithmetic is done on the digits rather than on a float, so that 19.99
// is exactly 1999.
export function parseLari(value: string): number | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function toLariInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function phoneLink(phone: string): string {
  return `tel:${phone.replaceAll(" ", "")}`;
}

export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}
