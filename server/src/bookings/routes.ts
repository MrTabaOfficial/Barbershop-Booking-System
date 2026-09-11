import { Router } from "express";
import { getAuth, requireAuth } from "../auth/middleware.ts";
import { env } from "../env.ts";
import { shopClockTimeOf, shopDateOf } from "../shop/time.ts";
import {
  bookingParamsSchema,
  createBookingSchema,
  rescheduleBookingSchema,
} from "./schemas.ts";
import {
  type BookingWithDetails,
  cancelBooking,
  createBooking,
  listBookings,
  rescheduleBooking,
} from "./service.ts";

// The booking as the API returns it. Statuses are lower case in the API,
// like roles. localDate and localTime are the start on the shop's clock.
function toPublicBooking(booking: BookingWithDetails) {
  return {
    id: booking.id,
    status: booking.status.toLowerCase(),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    localDate: shopDateOf(booking.startsAt, env.shopTimeZone),
    localTime: shopClockTimeOf(booking.startsAt, env.shopTimeZone),
    priceCents: booking.priceCents,
    depositCents: booking.depositCents,
    cancelledAt: booking.cancelledAt,
    cancelledInFreeWindow: booking.cancelledInFreeWindow,
    service: {
      id: booking.service.id,
      name: booking.service.name,
    },
    barber: {
      id: booking.barber.id,
      name: booking.barber.user.name,
    },
  };
}

export function createBookingsRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.post("/", async (req, res) => {
    const input = createBookingSchema.parse(req.body);
    const booking = await createBooking(getAuth(req).userId, input);
    res.status(201).json({ booking: toPublicBooking(booking) });
  });

  router.get("/mine", async (req, res) => {
    const { upcoming, past } = await listBookings(getAuth(req).userId);
    res.json({
      upcoming: upcoming.map(toPublicBooking),
      past: past.map(toPublicBooking),
    });
  });

  router.post("/:id/cancel", async (req, res) => {
    const { id } = bookingParamsSchema.parse(req.params);
    const booking = await cancelBooking(getAuth(req).userId, id);
    res.json({ booking: toPublicBooking(booking) });
  });

  router.post("/:id/reschedule", async (req, res) => {
    const { id } = bookingParamsSchema.parse(req.params);
    const { startsAt } = rescheduleBookingSchema.parse(req.body);
    const booking = await rescheduleBooking(getAuth(req).userId, id, startsAt);
    res.json({ booking: toPublicBooking(booking) });
  });

  return router;
}
