import { Router } from "express";
import { getAuth, requireAuth } from "../auth/middleware.ts";
import type { Dependencies } from "../dependencies.ts";
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

function toPublicBooking(booking: BookingWithDetails) {
  const awaitingPayment = booking.status === "PENDING";
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
    paymentStatus: booking.paymentStatus.toLowerCase(),
    paymentUrl: awaitingPayment ? booking.paymentUrl : null,
    heldUntilLocalTime:
      awaitingPayment && booking.holdExpiresAt
        ? shopClockTimeOf(booking.holdExpiresAt, env.shopTimeZone)
        : null,
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

export function createBookingsRouter(deps: Dependencies): Router {
  const router = Router();

  router.use(requireAuth);

  router.post("/", async (req, res) => {
    const input = createBookingSchema.parse(req.body);
    const { booking, checkoutUrl } = await createBooking(deps, getAuth(req).userId, input);
    res.status(201).json({ booking: toPublicBooking(booking), checkoutUrl });
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
    const booking = await cancelBooking(deps, getAuth(req).userId, id);
    res.json({ booking: toPublicBooking(booking) });
  });

  router.post("/:id/reschedule", async (req, res) => {
    const { id } = bookingParamsSchema.parse(req.params);
    const { startsAt } = rescheduleBookingSchema.parse(req.body);
    const booking = await rescheduleBooking(deps, getAuth(req).userId, id, startsAt);
    res.json({ booking: toPublicBooking(booking) });
  });

  return router;
}
