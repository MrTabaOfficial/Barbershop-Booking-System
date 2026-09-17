import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware.ts";
import { env } from "../env.ts";
import type { Service } from "../generated/prisma/client.ts";
import type { PaymentProvider } from "../payments/provider.ts";
import { shopClockTimeOf, shopDateOf } from "../shop/time.ts";
import {
  type AdminBooking,
  cancelBookingAsAdmin,
  findBookingsForExport,
  listBookings,
} from "./bookings.ts";
import {
  type BarberWithDetails,
  createBarber,
  createService,
  listBarbers,
  listServices,
  replaceWorkingHours,
  updateBarber,
  updateService,
} from "./catalog.ts";
import { bookingsToXlsx } from "./export.ts";
import { getOverview } from "./overview.ts";
import {
  bookingExportQuerySchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  createBarberSchema,
  createServiceSchema,
  idParamsSchema,
  overviewQuerySchema,
  updateBarberSchema,
  updateServiceSchema,
  workingHoursSchema,
} from "./schemas.ts";

function toAdminService(service: Service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    depositCents: service.depositCents,
    isActive: service.isActive,
  };
}

function toAdminBarber(barber: BarberWithDetails) {
  return {
    id: barber.id,
    name: barber.user.name,
    email: barber.user.email,
    bio: barber.bio,
    isActive: barber.isActive,
    workingHours: barber.workingHours.map((hours) => ({
      weekday: hours.weekday,
      startMinute: hours.startMinute,
      endMinute: hours.endMinute,
      breakStartMinute: hours.breakStartMinute,
      breakEndMinute: hours.breakEndMinute,
    })),
  };
}

function toAdminBooking(booking: AdminBooking) {
  return {
    id: booking.id,
    status: booking.status.toLowerCase(),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    localDate: shopDateOf(booking.startsAt, env.shopTimeZone),
    localTime: shopClockTimeOf(booking.startsAt, env.shopTimeZone),
    priceCents: booking.priceCents,
    depositCents: booking.depositCents,
    paymentStatus: booking.paymentStatus.toLowerCase(),
    service: { id: booking.service.id, name: booking.service.name },
    barber: { id: booking.barber.id, name: booking.barber.user.name },
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      email: booking.customer.email,
      phone: booking.customer.phone,
    },
  };
}

export function createAdminRouter(payments: PaymentProvider): Router {
  const router = Router();

  // Everything below is for the admin only.
  router.use(requireAuth, requireRole("admin"));

  // --- services

  router.get("/services", async (_req, res) => {
    res.json({ services: (await listServices()).map(toAdminService) });
  });

  router.post("/services", async (req, res) => {
    const service = await createService(createServiceSchema.parse(req.body));
    res.status(201).json({ service: toAdminService(service) });
  });

  router.patch("/services/:id", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const service = await updateService(id, updateServiceSchema.parse(req.body));
    res.json({ service: toAdminService(service) });
  });

  // --- barbers

  router.get("/barbers", async (_req, res) => {
    res.json({ barbers: (await listBarbers()).map(toAdminBarber) });
  });

  router.post("/barbers", async (req, res) => {
    const barber = await createBarber(createBarberSchema.parse(req.body));
    res.status(201).json({ barber: toAdminBarber(barber) });
  });

  router.patch("/barbers/:id", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const barber = await updateBarber(id, updateBarberSchema.parse(req.body));
    res.json({ barber: toAdminBarber(barber) });
  });

  router.put("/barbers/:id/working-hours", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const barber = await replaceWorkingHours(id, workingHoursSchema.parse(req.body));
    res.json({ barber: toAdminBarber(barber) });
  });

  // --- bookings

  router.get("/bookings", async (req, res) => {
    const query = bookingListQuerySchema.parse(req.query);
    const { bookings, total } = await listBookings(query);
    res.json({
      bookings: bookings.map(toAdminBooking),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  router.get("/bookings/export.xlsx", async (req, res) => {
    const filter = bookingExportQuerySchema.parse(req.query);
    const file = await bookingsToXlsx(await findBookingsForExport(filter));
    const today = shopDateOf(new Date(), env.shopTimeZone);
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`dalaki-bookings-${today}.xlsx`)
      .send(file);
  });

  router.post("/bookings/:id/cancel", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const { refund } = cancelBookingSchema.parse(req.body);
    const booking = await cancelBookingAsAdmin(payments, id, refund);
    res.json({ booking: toAdminBooking(booking) });
  });

  // --- overview

  router.get("/overview", async (req, res) => {
    const { from, to } = overviewQuerySchema.parse(req.query);
    res.json(await getOverview(from, to));
  });

  return router;
}
