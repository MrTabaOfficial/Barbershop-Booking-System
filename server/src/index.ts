import { createApp } from "./app.ts";
import { createDependencies } from "./dependencies.ts";
import { env } from "./env.ts";
import { startJobs } from "./jobs/index.ts";

const deps = createDependencies();

createApp(deps).listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);

  console.log(
    deps.payments.active.name === "stripe"
      ? "Payments: Stripe. Webhooks are expected at /payments/webhook."
      : "Payments: fake provider, because no Stripe keys are set. No money moves.",
  );
  console.log(
    env.smtp
      ? `Email: SMTP at ${env.smtp.host}:${env.smtp.port}.`
      : "Email: logged only, because SMTP_HOST is not set.",
  );
  console.log(
    env.telegram
      ? "Owner alerts: Telegram."
      : "Owner alerts: logged only, because no Telegram bot token is set.",
  );
});

// The jobs start here rather than in createApp, because tests build the app
// many times and must not start a set of timers each time.
startJobs(deps);
