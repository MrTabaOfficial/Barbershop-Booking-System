import type { IncomingHttpHeaders } from "node:http";

export type CheckoutRequest = {
  bookingId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  expiresAt: Date;
  successUrl: string;
  cancelUrl: string;
};

export type Checkout = {
  sessionId: string;
  url: string;
};

export type PaymentEvent =
  | { type: "payment_succeeded"; sessionId: string; paymentId: string }
  | { type: "checkout_expired"; sessionId: string }
  | { type: "ignored" };

export class InvalidWebhookError extends Error {}

export interface PaymentProvider {
  readonly name: string;

  createCheckout(request: CheckoutRequest): Promise<Checkout>;

  expireCheckout(sessionId: string): Promise<void>;

  refund(paymentId: string, idempotencyKey: string): Promise<void>;

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): PaymentEvent;
}
