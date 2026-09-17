import { env } from "../env.ts";
import { FakePaymentProvider } from "./fake.ts";
import type { PaymentProvider } from "./provider.ts";
import { StripePaymentProvider } from "./stripe.ts";

// The payment providers this server can use. One of them takes new
// deposits. A refund, though, must go back through whichever provider took
// that particular deposit, which each booking records by name.
export class PaymentProviders {
  // Takes new deposits.
  readonly active: PaymentProvider;
  private readonly byName = new Map<string, PaymentProvider>();

  constructor(active: PaymentProvider, others: PaymentProvider[] = []) {
    this.active = active;
    for (const provider of [active, ...others]) {
      this.byName.set(provider.name, provider);
    }
  }

  // The provider a booking was paid through, or undefined if this server
  // is no longer configured for it (Stripe's keys were removed, say).
  named(name: string | null): PaymentProvider | undefined {
    return name === null ? undefined : this.byName.get(name);
  }
}

// Stripe takes new deposits when its keys are in .env, the fake otherwise.
// The fake is always there as well: the seeded demo bookings were "paid"
// through it, so that is where their refunds go even with Stripe switched on.
export function createPaymentProviders(): PaymentProviders {
  // The fake's checkout page is served by this API. The browser reaches the
  // API through the website's /api proxy.
  const fake = new FakePaymentProvider(
    (sessionId) => `${env.appUrl}/api/payments/fake-checkout/${sessionId}`,
  );
  return env.stripe
    ? new PaymentProviders(new StripePaymentProvider(env.stripe), [fake])
    : new PaymentProviders(fake);
}
