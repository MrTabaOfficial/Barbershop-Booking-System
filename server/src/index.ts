import { createApp } from "./app.ts";
import { env } from "./env.ts";
import { createPaymentProvider } from "./payments/index.ts";

const payments = createPaymentProvider();

createApp({ payments }).listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
  console.log(
    payments.name === "stripe"
      ? "Payments: Stripe. Webhooks are expected at /payments/webhook."
      : "Payments: fake provider, because no Stripe keys are set. No money moves.",
  );
});
