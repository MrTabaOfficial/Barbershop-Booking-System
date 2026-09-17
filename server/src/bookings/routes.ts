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

// The booking as the API returns it. Statuses are lower case in the API,
// like roles. localDate and localTime are the start on the shop's clock.
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
    // Only while the deposit is unpaid: where to pay it, and the shop clock
    // time at which the slot stops being held.
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
    // checkoutUrl is the page to send the customer to next. It is null when
    // the service has no deposit and the booking is confirmed already.
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
