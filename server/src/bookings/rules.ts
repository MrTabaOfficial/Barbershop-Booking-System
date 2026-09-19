export const FREE_CANCELLATION_HOURS = 24;

// Stripe won't create a checkout that expires in under 30 minutes, so the
// hold is half a minute longer to cover the time the request takes to reach
// Stripe.
export const PAYMENT_HOLD_MS = 30 * 60_000 + 30_000;

export const PAYMENT_CURRENCY = "gel";
