import path from "node:path";
import { defineConfig } from "@playwright/test";
import { API_PORT, API_URL, DATABASE_URL, repoRoot, WEB_PORT, WEB_URL } from "./environment.ts";

export default defineConfig({
  testDir: "tests",
  globalSetup: "./global-setup.ts",

  // The tests share one database and book real slots with one barber, so
  // they run one at a time, in order.
  workers: 1,
  fullyParallel: false,
  reporter: "list",

  use: {
    baseURL: WEB_URL,
    // A phone-sized window: the site is designed mobile-first.
    viewport: { width: 390, height: 844 },
    // Keep evidence only when something fails (in test-results/).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // Playwright starts both servers before the tests and stops them after.
  // Variables set here win over the ones in .env.
  webServer: [
    {
      command: "npm run start",
      cwd: path.join(repoRoot, "server"),
      env: {
        DATABASE_URL,
        PORT: String(API_PORT),
        // Payment pages send the customer back to the website under test.
        APP_URL: WEB_URL,
        // Never Stripe, whatever keys are in .env: empty means the fake
        // payment provider, whose checkout page the tests can click through.
        STRIPE_SECRET_KEY: "",
        STRIPE_WEBHOOK_SECRET: "",
        // Emails and owner alerts go to the log, not to Mailpit or Telegram.
        SMTP_HOST: "",
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_OWNER_CHAT_ID: "",
      },
      url: `${API_URL}/shop`,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      cwd: path.join(repoRoot, "client"),
      // The website's proxy reads PORT to find the API.
      env: { PORT: String(API_PORT) },
      url: WEB_URL,
      reuseExistingServer: false,
    },
  ],
});
