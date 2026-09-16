const NO_BREAK_SPACE = " ";

// 4500 -> "45 ₾". Amounts arrive in tetri, a hundredth of a lari.
export function formatPrice(cents: number): string {
  const lari = (cents / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 });
  return `${lari}${NO_BREAK_SPACE}₾`;
}

// 45 -> "45 min", 75 -> "1 h 15 min"
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Minutes after midnight -> "10:00"
export function formatClock(minutesAfterMidnight: number): string {
  const hours = Math.floor(minutesAfterMidnight / 60);
  const minutes = minutesAfterMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// "10:00" -> 600. Null for anything that isn't a clock time.
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

// What someone types into a price field -> tetri. Accepts "45", "45.5" and
// "45,50". Null when it isn't an amount. The arithmetic is done on the
// digits, not on a float, so 19.99 is exactly 1999.
export function parseLari(value: string): number | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

// Tetri -> the text to put in a price field: "45" or "45.50".
export function toLariInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

// 0.184 -> "18%"
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// "Giorgi Kapanadze" -> "Giorgi"
export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}
