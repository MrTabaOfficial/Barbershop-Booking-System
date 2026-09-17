import { Telegram } from "telegraf";

// Short messages to the shop's owner: a new booking, a cancellation, the
// day's summary.
export interface OwnerAlerts {
  // "telegram" or "log", for the startup message.
  readonly name: string;
  // Rejects if the message couldn't be sent.
  send(text: string): Promise<void>;
}

// Sends to one Telegram chat through a bot. Only Telegraf's API client is
// used: the bot sends messages and never listens for any.
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

// Used when no bot token is set: the alert goes to the server's log instead.
export class LogOwnerAlerts implements OwnerAlerts {
  readonly name = "log";

  async send(text: string): Promise<void> {
    console.log(`[owner alert, not sent: no TELEGRAM_BOT_TOKEN] ${text}`);
  }
}
