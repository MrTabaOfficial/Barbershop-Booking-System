import { z } from "zod";

// An exact instant in UTC, e.g. "2026-10-06T06:00:00.000Z", as returned by
// GET /availability.
const startsAt = z.iso.datetime().transform((value) => new Date(value));

export const createBookingSchema = z.object({
  barberId: z.uuid(),
  serviceId: z.uuid(),
  startsAt,
});

export const rescheduleBookingSchema = z.object({ startsAt });

export const bookingParamsSchema = z.object({ id: z.uuid() });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
