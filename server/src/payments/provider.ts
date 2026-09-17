import type { IncomingHttpHeaders } from "node:http";

// Everything the rest of the server knows about taking money. There are two
// implementations: StripePaymentProvider for real (test-mode) payments, and
// FakePaymentProvider, which needs no account or network and is what the
// tests and a fresh checkout of the project run on.

export type CheckoutRequest = {
  bookingId: string;
  amountCents: number;
  // ISO currency code, lower case, as payment providers write it.
  currency: string;
  // What the customer sees they are paying for.
  description: string;
  customerEmail: string;
  // After this moment the checkout must refuse payment.
  expiresAt: Date;
  // Where the customer's browser is sent afterwards.
  successUrl: string;
  cancelUrl: string;
};

export type Checkout = {
  // Identifies the checkout; stored on the booking.
  sessionId: string;
  // The page to send the customer to.
  url: string;
};

// What a provider can tell us happened, in our own words.
export type PaymentEvent =
  | { type: "payment_succeeded"; sessionId: string; paymentId: string }
  | { type: "checkout_expired"; sessionId: string }
  // Anything this application doesn't act on.
  | { type: "ignored" };

// Thrown by parseWebhook when a message can't be trusted.
export class InvalidWebhookError extends Error {}

export interface PaymentProvider {
  // "stripe" or "fake", for the startup log.
  readonly name: string;

  createCheckout(request: CheckoutRequest): Promise<Checkout>;

  // Closes a checkout so it can no longer be paid.
  expireCheckout(sessionId: string): Promise<void>;

  // Gives a payment back in full. Calling it again with the same key must
  // not refund twice.
  refund(paymentId: string, idempotencyKey: string): Promise<void>;

  // Checks that a webhook really came from the provider and translates it.
  // It must be given the body exactly as it arrived, byte for byte: the
  // signature is calculated over those bytes. Throws InvalidWebhookError.
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): PaymentEvent;
}
