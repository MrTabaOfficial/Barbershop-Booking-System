// The name and wordmark are also in client/src/brand.ts, because the logo is
// drawn before any request has answered; everything else reaches the website
// through GET /shop.
export const shopDetails = {
  name: "Dalaki",
  wordmark: "დალაქი",
  address: {
    street: "27 Lado Asatiani Street",
    district: "Sololaki",
    city: "Tbilisi 0105",
  },
  directions: "Five minutes on foot from Liberty Square metro.",
  phone: "+995 555 00 00 00",
};

export const shopAddressLine = [
  shopDetails.address.street,
  shopDetails.address.district,
  shopDetails.address.city,
].join(", ");

export function formatLari(cents: number): string {
  const lari = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `${lari} ₾`;
}
