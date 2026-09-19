import { Router } from "express";
import { MAX_DAYS_AHEAD } from "../availability/slots.ts";
import { FREE_CANCELLATION_HOURS } from "../bookings/rules.ts";
import { env } from "../env.ts";
import { shopDetails } from "./details.ts";
import { addDays, shopDateOf } from "./time.ts";

export function createShopRouter(): Router {
  const router = Router();

  // The client gets these facts from the server so that it doesn't guess them
  // from the visitor's own clock.
  router.get("/", (_req, res) => {
    const today = shopDateOf(new Date(), env.shopTimeZone);
    res.json({
      timeZone: env.shopTimeZone,
      today,
      lastBookableDate: addDays(today, MAX_DAYS_AHEAD),
      freeCancellationHours: FREE_CANCELLATION_HOURS,
      address: shopDetails.address,
      directions: shopDetails.directions,
      phone: shopDetails.phone,
    });
  });

  return router;
}
