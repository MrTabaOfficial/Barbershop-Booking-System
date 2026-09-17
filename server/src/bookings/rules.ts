// The numbers the booking rules turn on, in one place.

// Cancelling this long before the start refunds the deposit, and a booking
// can be moved only until then.
export const FREE_CANCELLATION_HOURS = 24;

// How long an unpaid booking holds its slot. Stripe won't create a checkout
// that expires in under 30 minutes; the extra half minute covers the time
// the request takes to reach Stripe, so the limit is never missed.
export const PAYMENT_HOLD_MS = 30 * 60_000 + 30_000;

// The shop charges in Georgian lari.
export const PAYMENT_CURRENCY = "gel";
