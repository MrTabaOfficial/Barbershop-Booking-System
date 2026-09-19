import { Router } from "express";
import { getAuth, requireAuth, requireRole } from "../auth/middleware.ts";
import { env } from "../env.ts";
import type { DayOff } from "../generated/prisma/client.ts";
import { fromDateColumn, shopClockTimeOf, shopDateOf } from "../shop/time.ts";
import { addDayOffSchema, idParamsSchema, scheduleQuerySchema } from "./schemas.ts";
import {
  addDayOff,
  getBarberOf,
  getSchedule,
  listUpcomingDaysOff,
  recordOutcome,
  removeDayOff,
  type ScheduleBooking,
} from "./service.ts";

function toScheduleBooking(booking: ScheduleBooking) {
  return {
    id: booking.id,
    status: booking.status.toLowerCase(),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    localDate: shopDateOf(booking.startsAt, env.shopTimeZone),
    localTime: shopClockTimeOf(booking.startsAt, env.shopTimeZone),
    localEndTime: shopClockTimeOf(booking.endsAt, env.shopTimeZone),
    priceCents: booking.priceCents,
    service: { id: booking.service.id, name: booking.service.name },
    customer: { name: booking.customer.name, phone: booking.customer.phone },
  };
}

function toPublicDayOff(dayOff: DayOff) {
  return { id: dayOff.id, date: fromDateColumn(dayOff.date), reason: dayOff.reason };
}

export function createBarberRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole("barber"));

  router.get("/schedule", async (req, res) => {
    const { from, to } = scheduleQuerySchema.parse(req.query);
    const barber = await getBarberOf(getAuth(req).userId);
    const days = await getSchedule(barber, from, to);

    res.json({
      days: days.map((day) => ({
        date: day.date,
        workingHours: day.workingHours && {
          startMinute: day.workingHours.startMinute,
          endMinute: day.workingHours.endMinute,
          breakStartMinute: day.workingHours.breakStartMinute,
          breakEndMinute: day.workingHours.breakEndMinute,
        },
        dayOff: day.dayOff && toPublicDayOff(day.dayOff),
        bookings: day.bookings.map(toScheduleBooking),
      })),
    });
  });

  router.post("/bookings/:id/complete", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const barber = await getBarberOf(getAuth(req).userId);
    const booking = await recordOutcome(barber, id, "COMPLETED");
    res.json({ booking: toScheduleBooking(booking) });
  });

  router.post("/bookings/:id/no-show", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const barber = await getBarberOf(getAuth(req).userId);
    const booking = await recordOutcome(barber, id, "NO_SHOW");
    res.json({ booking: toScheduleBooking(booking) });
  });

  router.get("/days-off", async (req, res) => {
    const barber = await getBarberOf(getAuth(req).userId);
    const daysOff = await listUpcomingDaysOff(barber);
    res.json({ daysOff: daysOff.map(toPublicDayOff) });
  });

  router.post("/days-off", async (req, res) => {
    const input = addDayOffSchema.parse(req.body);
    const barber = await getBarberOf(getAuth(req).userId);
    const dayOff = await addDayOff(barber, input);
    res.status(201).json({ dayOff: toPublicDayOff(dayOff) });
  });

  router.delete("/days-off/:id", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const barber = await getBarberOf(getAuth(req).userId);
    await removeDayOff(barber, id);
    res.status(204).end();
  });

  return router;
}
