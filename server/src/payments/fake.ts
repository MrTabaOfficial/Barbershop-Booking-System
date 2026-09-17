import { randomUUID } from "node:crypto";
import {
  type Checkout,
  type CheckoutRequest,
  InvalidWebhookError,
  type PaymentEvent,
  type PaymentProvider,
} from "./provider.ts";

// A stand-in for Stripe that lives entirely in this process's memory. It
// lets the whole booking flow run, in tests and on a machine with no Stripe
// account, and it records what it was asked to do so tests can check.
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";

  readonly checkouts = new Map<string, CheckoutRequest>();
  readonly expiredSessionIds: string[] = [];
  readonly refunds: { paymentId: string; idempotencyKey: string }[] = [];

  // A test sets these to see what happens when the provider is down.
  failCheckouts = false;
  failRefunds = false;

  // Builds the address of the fake checkout page for a session.
  private readonly checkoutPageUrl: (sessionId: string) => string;

  constructor(checkoutPageUrl: (sessionId: string) => string) {
    this.checkoutPageUrl = checkoutPageUrl;
  }

  async createCheckout(request: CheckoutRequest): Promise<Checkout> {
    if (this.failCheckouts) {
      throw new Error("The fake payment provider was told to fail checkouts");
    }
    const sessionId = `fake_cs_${randomUUID()}`;
    this.checkouts.set(sessionId, request);
    return { sessionId, url: this.checkoutPageUrl(sessionId) };
  }

  async expireCheckout(sessionId: string): Promise<void> {
    this.expiredSessionIds.push(sessionId);
  }

  async refund(paymentId: string, idempotencyKey: string): Promise<void> {
    if (this.failRefunds) {
      throw new Error("The fake payment provider was told to fail refunds");
    }
    // Like the real thing, a repeated key is not a second refund.
    if (!this.refunds.some((refund) => refund.idempotencyKey === idempotencyKey)) {
      this.refunds.push({ paymentId, idempotencyKey });
    }
  }

  // The fake sends no webhooks. Its checkout page reports a payment by
  // calling the same handler a webhook would reach.
  parseWebhook(): PaymentEvent {
    throw new InvalidWebhookError("The fake payment provider does not send webhooks");
  }

  // The payment id a paid fake checkout gets.
  paymentIdFor(sessionId: string): string {
    return sessionId.replace("fake_cs_", "fake_pay_");
  }
}
