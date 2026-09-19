import path from "node:path";
import { defineConfig } from "vitest/config";

process.loadEnvFile(path.resolve(import.meta.dirname, "../.env"));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

const testDatabaseUrl = new URL(process.env.DATABASE_URL);
testDatabaseUrl.pathname += "_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl.href,
      // The blank values keep tests away from Stripe, a mail server and
      // Telegram, whatever is in .env.
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      SMTP_HOST: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_OWNER_CHAT_ID: "",
    },
    globalSetup: "tests/global-setup.ts",
    fileParallelism: false,
    // Without this, a test that silences console.error would silence it for
    // every later test in its file, and hide errors nobody expected.
    restoreMocks: true,
  },
});
