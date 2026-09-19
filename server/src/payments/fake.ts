import { randomUUID } from "node:crypto";
import {
  type Checkout,
  type CheckoutRequest,
  InvalidWebhookError,
  type PaymentEvent,
  type PaymentProvider,
} from "./provider.ts";

export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";

  readonly checkouts = new Map<string, CheckoutRequest>();
  readonly expiredSessionIds: string[] = [];
  readonly refunds: { paymentId: string; idempotencyKey: string }[] = [];

  failCheckouts = false;
  failRefunds = false;

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
    if (!this.refunds.some((refund) => refund.idempotencyKey === idempotencyKey)) {
      this.refunds.push({ paymentId, idempotencyKey });
    }
  }

  parseWebhook(): PaymentEvent {
    throw new InvalidWebhookError("The fake payment provider does not send webhooks");
  }

  paymentIdFor(sessionId: string): string {
    return sessionId.replace("fake_cs_", "fake_pay_");
  }
}
