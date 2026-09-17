import { env } from "../env.ts";
import { FakePaymentProvider } from "./fake.ts";
import type { PaymentProvider } from "./provider.ts";
import { StripePaymentProvider } from "./stripe.ts";

// Stripe when its keys are in .env, the fake otherwise. So the project runs
// straight after cloning, and takes test-mode payments once keys are added.
export function createPaymentProvider(): PaymentProvider {
  if (env.stripe) {
    return new StripePaymentProvider(env.stripe);
  }
  // The fake's checkout page is served by this API. The browser reaches the
  // API through the website's /api proxy.
  return new FakePaymentProvider(
    (sessionId) => `${env.appUrl}/api/payments/fake-checkout/${sessionId}`,
  );
}
