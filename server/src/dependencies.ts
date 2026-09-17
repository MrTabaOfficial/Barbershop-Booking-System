import { env } from "./env.ts";
import { LogMailer, type Mailer, SmtpMailer } from "./notifications/mailer.ts";
import {
  LogOwnerAlerts,
  type OwnerAlerts,
  TelegramOwnerAlerts,
} from "./notifications/ownerAlerts.ts";
import { createPaymentProviders, type PaymentProviders } from "./payments/index.ts";

// The services that reach outside this process: payments, email, and
// alerts to the owner. They are created once and handed to the code that
// needs them, rather than imported directly, so tests can pass in
// stand-ins and watch what they are asked to do.
export type Dependencies = {
  payments: PaymentProviders;
  mailer: Mailer;
  ownerAlerts: OwnerAlerts;
};

// The real ones, chosen by what .env configures. Anything not configured
// falls back to a stand-in that works without it.
export function createDependencies(): Dependencies {
  return {
    payments: createPaymentProviders(),
    mailer: env.smtp ? new SmtpMailer(env.smtp, env.mailFrom) : new LogMailer(),
    ownerAlerts: env.telegram ? new TelegramOwnerAlerts(env.telegram) : new LogOwnerAlerts(),
  };
}
