import { env } from "./env.ts";
import { LogMailer, type Mailer, SmtpMailer } from "./notifications/mailer.ts";
import {
  LogOwnerAlerts,
  type OwnerAlerts,
  TelegramOwnerAlerts,
} from "./notifications/ownerAlerts.ts";
import { createPaymentProviders, type PaymentProviders } from "./payments/index.ts";

export type Dependencies = {
  payments: PaymentProviders;
  mailer: Mailer;
  ownerAlerts: OwnerAlerts;
};

export function createDependencies(): Dependencies {
  return {
    payments: createPaymentProviders(),
    mailer: env.smtp ? new SmtpMailer(env.smtp, env.mailFrom) : new LogMailer(),
    ownerAlerts: env.telegram ? new TelegramOwnerAlerts(env.telegram) : new LogOwnerAlerts(),
  };
}
