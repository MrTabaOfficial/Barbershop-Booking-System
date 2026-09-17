import { createApp } from "./app.ts";
import { createDependencies } from "./dependencies.ts";
import { env } from "./env.ts";
import { startJobs } from "./jobs/index.ts";

const deps = createDependencies();

createApp(deps).listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);

  // Say which outside services are really connected, because each one
  // quietly falls back to a stand-in when it isn't configured.
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

// Only here, not in createApp: tests build the app many times and must not
// start a set of timers each time.
startJobs(deps);
