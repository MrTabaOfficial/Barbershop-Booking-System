import type { IncomingHttpHeaders } from "node:http";
import Stripe from "stripe";
import {
  type Checkout,
  type CheckoutRequest,
  InvalidWebhookError,
  type PaymentEvent,
  type PaymentProvider,
} from "./provider.ts";

type StripeOptions = {
  secretKey: string;
  webhookSecret: string;
  api?: { host: string; port: number; protocol: "http" | "https" };
};

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(options: StripeOptions) {
    this.stripe = new Stripe(options.secretKey, options.api);
    this.webhookSecret = options.webhookSecret;
  }

  async createCheckout(request: CheckoutRequest): Promise<Checkout> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency,
              unit_amount: request.amountCents,
              product_data: { name: request.description },
            },
          },
        ],
        customer_email: request.customerEmail,
        client_reference_id: request.bookingId,
        metadata: { bookingId: request.bookingId },
        expires_at: Math.floor(request.expiresAt.getTime() / 1000),
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      },
      { idempotencyKey: `checkout-${request.bookingId}` },
    );
    if (!session.url) {
      throw new Error(`Stripe created checkout session ${session.id} without a URL`);
    }
    return { sessionId: session.id, url: session.url };
  }

  async expireCheckout(sessionId: string): Promise<void> {
    await this.stripe.checkout.sessions.expire(sessionId);
  }

  async refund(paymentId: string, idempotencyKey: string): Promise<void> {
    await this.stripe.refunds.create({ payment_intent: paymentId }, { idempotencyKey });
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): PaymentEvent {
    const signature = headers["stripe-signature"];
    if (typeof signature !== "string") {
      throw new InvalidWebhookError("The Stripe-Signature header is missing");
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new InvalidWebhookError("The webhook signature does not match");
    }

    switch (event.type) {
      // A card pays at once, so "completed" already means paid; methods that
      // pay later complete unpaid, which is ignored, and report the money in
      // a second event.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status !== "paid" || typeof session.payment_intent !== "string") {
          return { type: "ignored" };
        }
        return {
          type: "payment_succeeded",
          sessionId: session.id,
          paymentId: session.payment_intent,
        };
      }
      case "checkout.session.expired":
        return { type: "checkout_expired", sessionId: event.data.object.id };
      default:
        return { type: "ignored" };
    }
  }

  signForTest(payload: string): string {
    return this.stripe.webhooks.generateTestHeaderString({ payload, secret: this.webhookSecret });
  }
}
