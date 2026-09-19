import cron from "node-cron";
import type { Dependencies } from "../dependencies.ts";
import { env } from "../env.ts";
import { expireUnpaidBookings } from "../payments/service.ts";
import { deleteDeadRefreshTokens } from "./cleanup.ts";
import { sendDailySummary } from "./dailySummary.ts";
import { sendReminders } from "./reminders.ts";

const EVERY_MINUTE = "* * * * *";
const EVERY_FIVE_MINUTES = "*/5 * * * *";
const EVERY_TEN_MINUTES = "*/10 * * * *";
const NIGHTLY_AT_03_30 = "30 3 * * *";

function job(name: string, run: () => Promise<number | boolean>) {
  return async () => {
    try {
      const result = await run();
      if (result) {
        console.log(`[job] ${name}: ${result === true ? "done" : result}`);
      }
    } catch (error) {
      console.error(`[job] ${name} failed`, error);
    }
  };
}

export function startJobs(deps: Dependencies): void {
  const options = {
    timezone: env.shopTimeZone,
    noOverlap: true,
  };

  cron.schedule(EVERY_MINUTE, job("expire unpaid bookings", () => expireUnpaidBookings()), options);
  cron.schedule(EVERY_TEN_MINUTES, job("send reminders", () => sendReminders(deps)), options);
  cron.schedule(EVERY_FIVE_MINUTES, job("send the daily summary", () => sendDailySummary(deps)), options);
  cron.schedule(NIGHTLY_AT_03_30, job("delete dead refresh tokens", () => deleteDeadRefreshTokens()), options);
}
