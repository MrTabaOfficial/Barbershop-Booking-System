// Facts about the shop, for emails and alerts. The website keeps its own
// copy in client/src/shop.ts; if the shop moves, change both.
export const shopDetails = {
  name: "Dalaki",
  // "Barber" in Georgian.
  wordmark: "დალაქი",
  address: "27 Lado Asatiani Street, Sololaki, Tbilisi 0105",
  phone: "+995 555 00 00 00",
};

// 4500 -> "45 ₾". Amounts are stored in tetri, a hundredth of a lari.
export function formatLari(cents: number): string {
  const lari = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${lari} ₾`;
}
