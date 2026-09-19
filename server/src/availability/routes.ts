import { Router } from "express";
import { z } from "zod";
import { optionalAuth } from "../auth/middleware.ts";
import { env } from "../env.ts";
import { shopClockTimeOf } from "../shop/time.ts";
import { findAvailableSlots, findOwnBookingId, getActiveService } from "./service.ts";

const availabilityQuerySchema = z.object({
  barberId: z.uuid(),
  serviceId: z.uuid(),
  date: z.iso.date(),
  excludeBookingId: z.uuid().optional(),
});

export function createAvailabilityRouter(): Router {
  const router = Router();

  router.get("/", optionalAuth, async (req, res) => {
    const query = availabilityQuerySchema.parse(req.query);
    const service = await getActiveService(query.serviceId);
    const slots = await findAvailableSlots({
      barberId: query.barberId,
      shopDate: query.date,
      durationMinutes: service.durationMinutes,
      ignoreBookingId: await findOwnBookingId(query.excludeBookingId, req.auth?.userId),
    });

    res.json({
      date: query.date,
      timeZone: env.shopTimeZone,
      slots: slots.map((slot) => ({
        startsAt: slot.toISOString(),
        localTime: shopClockTimeOf(slot, env.shopTimeZone),
      })),
    });
  });

  return router;
}
