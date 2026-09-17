import nodemailer, { type Transporter } from "nodemailer";

export type Email = {
  to: string;
  subject: string;
  // The same message twice: plain text for mail programs that want it, and
  // HTML for the rest.
  text: string;
  html: string;
};

export interface Mailer {
  // "smtp" or "log", for the startup message.
  readonly name: string;
  // Rejects if the message couldn't be handed over.
  send(email: Email): Promise<void>;
}

// Sends through an SMTP server. In development that is Mailpit, which
// catches every message and shows it in a web inbox instead of delivering it.
export class SmtpMailer implements Mailer {
  readonly name = "smtp";
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(smtp: { host: string; port: number }, from: string) {
    this.transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port });
    this.from = from;
  }

  async send(email: Email): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...email });
  }
}

// Used when no SMTP server is configured: says what would have been sent.
export class LogMailer implements Mailer {
  readonly name = "log";

  async send(email: Email): Promise<void> {
    console.log(`[email, not sent: no SMTP_HOST] to ${email.to}: ${email.subject}`);
  }
}
