import cron from "node-cron";
import type { Dependencies } from "../dependencies.ts";
import { env } from "../env.ts";
import { expireUnpaidBookings } from "../payments/service.ts";
import { deleteDeadRefreshTokens } from "./cleanup.ts";
import { sendDailySummary } from "./dailySummary.ts";
import { sendReminders } from "./reminders.ts";

// The work that happens on a schedule rather than in answer to a request.
//
// Every job is written so that running it twice does no harm, and each
// decides for itself, from the clock and the database, whether there is
// anything to do. So the schedules below only say how often to look. A job
// that was missed because the server was off simply catches up next time.

// Runs a job, reports what it did if it did anything, and never lets a
// failure escape: an error in one run must not stop the next.
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
    // Cron times are on the shop's clock, not the server's.
    timezone: env.shopTimeZone,
    // If a run is still going when the next is due, skip that one.
    noOverlap: true,
  };

  // Every minute: release slots whose unpaid hold has run out.
  cron.schedule("* * * * *", job("expire unpaid bookings", () => expireUnpaidBookings()), options);

  // Every ten minutes: tomorrow's reminders. The job itself waits until
  // mid-morning before sending any.
  cron.schedule("*/10 * * * *", job("send reminders", () => sendReminders(deps)), options);

  // Every five minutes: the day's summary. The job itself waits until
  // closing time, and sends at most one a day.
  cron.schedule("*/5 * * * *", job("send the daily summary", () => sendDailySummary(deps)), options);

  // Once a night, at 03:30: clear out refresh tokens that are no use.
  cron.schedule("30 3 * * *", job("delete dead refresh tokens", () => deleteDeadRefreshTokens()), options);
}
