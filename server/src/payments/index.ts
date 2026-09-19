import { env } from "../env.ts";
import { FakePaymentProvider } from "./fake.ts";
import type { PaymentProvider } from "./provider.ts";
import { StripePaymentProvider } from "./stripe.ts";

export class PaymentProviders {
  readonly active: PaymentProvider;
  private readonly byName = new Map<string, PaymentProvider>();

  constructor(active: PaymentProvider, others: PaymentProvider[] = []) {
    this.active = active;
    for (const provider of [active, ...others]) {
      this.byName.set(provider.name, provider);
    }
  }

  named(name: string | null): PaymentProvider | undefined {
    return name === null ? undefined : this.byName.get(name);
  }
}

// The fake is always there, because the seeded demo bookings were "paid"
// through it and that is where their refunds go even with Stripe switched on.
export function createPaymentProviders(): PaymentProviders {
  const fake = new FakePaymentProvider(
    (sessionId) => `${env.appUrl}/api/payments/fake-checkout/${sessionId}`,
  );
  return env.stripe
    ? new PaymentProviders(new StripePaymentProvider(env.stripe), [fake])
    : new PaymentProviders(fake);
}
