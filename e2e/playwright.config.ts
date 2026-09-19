import path from "node:path";
import { defineConfig } from "@playwright/test";
import { API_PORT, API_URL, DATABASE_URL, repoRoot, WEB_PORT, WEB_URL } from "./environment.ts";

export default defineConfig({
  testDir: "tests",
  globalSetup: "./global-setup.ts",

  workers: 1,
  fullyParallel: false,
  reporter: "list",

  use: {
    baseURL: WEB_URL,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: [
    {
      command: "npm run start",
      cwd: path.join(repoRoot, "server"),
      env: {
        DATABASE_URL,
        PORT: String(API_PORT),
        APP_URL: WEB_URL,
        STRIPE_SECRET_KEY: "",
        STRIPE_WEBHOOK_SECRET: "",
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
      env: { PORT: String(API_PORT) },
      url: WEB_URL,
      reuseExistingServer: false,
    },
  ],
});
