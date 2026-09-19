import { Telegram } from "telegraf";

export interface OwnerAlerts {
  readonly name: string;
  send(text: string): Promise<void>;
}

export class TelegramOwnerAlerts implements OwnerAlerts {
  readonly name = "telegram";
  private readonly telegram: Telegram;
  private readonly chatId: string;

  constructor(options: { botToken: string; chatId: string }) {
    this.telegram = new Telegram(options.botToken);
    this.chatId = options.chatId;
  }

  async send(text: string): Promise<void> {
    await this.telegram.sendMessage(this.chatId, text);
  }
}

export class LogOwnerAlerts implements OwnerAlerts {
  readonly name = "log";

  async send(text: string): Promise<void> {
    console.log(`[owner alert, not sent: no TELEGRAM_BOT_TOKEN] ${text}`);
  }
}
