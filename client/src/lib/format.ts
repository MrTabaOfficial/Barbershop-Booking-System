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

// "Giorgi Kapanadze" -> "Giorgi"
export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}
