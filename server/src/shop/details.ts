// The website keeps its own copy in client/src/shop.ts, so a change here has
// to be made there too.
export const shopDetails = {
  name: "Dalaki",
  wordmark: "დალაქი",
  address: "27 Lado Asatiani Street, Sololaki, Tbilisi 0105",
  phone: "+995 555 00 00 00",
};

export function formatLari(cents: number): string {
  const lari = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${lari} ₾`;
}
