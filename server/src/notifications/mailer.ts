import nodemailer, { type Transporter } from "nodemailer";

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface Mailer {
  readonly name: string;
  send(email: Email): Promise<void>;
}

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

export class LogMailer implements Mailer {
  readonly name = "log";

  async send(email: Email): Promise<void> {
    console.log(`[email, not sent: no SMTP_HOST] to ${email.to}: ${email.subject}`);
  }
}
