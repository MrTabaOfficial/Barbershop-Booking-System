import { z } from "zod";
import { MAX_PASSWORD_LENGTH } from "../auth/password.ts";
import { SLOT_STEP_MINUTES } from "../availability/slots.ts";

export const idParamsSchema = z.object({ id: z.uuid() });

// --- services

const serviceName = z.string().trim().min(1).max(100);
const description = z.string().trim().max(500).nullable();
// Durations follow the booking grid, so a service never leaves a gap that
// no other booking can start in.
const durationMinutes = z
  .number()
  .int()
  .min(SLOT_STEP_MINUTES)
  .max(8 * 60)
  .refine((value) => value % SLOT_STEP_MINUTES === 0, {
    message: `Must be a multiple of ${SLOT_STEP_MINUTES} minutes`,
  });
// In tetri. The ceiling only catches typing mistakes.
const amountCents = z.number().int().min(0).max(1_000_000);

export const createServiceSchema = z.object({
  name: serviceName,
  description: description.optional(),
  durationMinutes,
  priceCents: amountCents,
  depositCents: amountCents,
});

export const updateServiceSchema = z
  .object({
    name: serviceName,
    description,
    durationMinutes,
    priceCents: amountCents,
    depositCents: amountCents,
    isActive: z.boolean(),
  })
  .partial();

// --- barbers

const personName = z.string().trim().min(1).max(100);
const bio = z.string().trim().max(1000).nullable();

export const createBarberSchema = z.object({
  name: personName,
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(MAX_PASSWORD_LENGTH),
  bio: bio.optional(),
});

export const updateBarberSchema = z
  .object({ name: personName, bio, isActive: z.boolean() })
  .partial();

const minuteOfDay = z.number().int().min(0).max(24 * 60);

const workingDaySchema = z
  .object({
    // 0 = Sunday ... 6 = Saturday
    weekday: z.number().int().min(0).max(6),
    startMinute: minuteOfDay,
    endMinute: minuteOfDay,
    breakStartMinute: minuteOfDay.nullable(),
    breakEndMinute: minuteOfDay.nullable(),
  })
  .superRefine((day, context) => {
    if (day.endMinute <= day.startMinute) {
      context.addIssue({ code: "custom", path: ["endMinute"], message: "Must be after the start" });
    }
    const hasBreakStart = day.breakStartMinute !== null;
    const hasBreakEnd = day.breakEndMinute !== null;
    if (hasBreakStart !== hasBreakEnd) {
      context.addIssue({
        code: "custom",
        path: ["breakEndMinute"],
        message: "Give both a start and an end for the break, or neither",
      });
    } else if (day.breakStartMinute !== null && day.breakEndMinute !== null) {
      const insideTheDay =
        day.breakStartMinute >= day.startMinute && day.breakEndMinute <= day.endMinute;
      if (day.breakEndMinute <= day.breakStartMinute || !insideTheDay) {
        context.addIssue({
          code: "custom",
          path: ["breakStartMinute"],
          message: "The break must fall inside the working hours and end after it starts",
        });
      }
    }
  });

// The whole week at once: the days listed are the days the barber works.
export const workingHoursSchema = z.object({
  days: z
    .array(workingDaySchema)
    .max(7)
    .refine((days) => new Set(days.map((day) => day.weekday)).size === days.length, {
      message: "Each weekday may appear only once",
    }),
});

// --- bookings

export const BOOKING_STATUS_NAMES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export const BOOKING_SORT_KEYS = [
  "startsAt",
  "customer",
  "barber",
  "service",
  "status",
  "price",
] as const;

const bookingFilterFields = {
  // Shop dates, both included.
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  barberId: z.uuid().optional(),
  status: z.enum(BOOKING_STATUS_NAMES).optional(),
  // Matched against the customer's name, email and phone.
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(BOOKING_SORT_KEYS).default("startsAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
};

// The export takes the same filters and sorting as the table, without paging.
export const bookingExportQuerySchema = z.object(bookingFilterFields);

export const bookingListQuerySchema = z.object({
  ...bookingFilterFields,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type BookingFilter = z.infer<typeof bookingExportQuerySchema>;
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;

// --- overview

export const MAX_OVERVIEW_DAYS = 366;

export const overviewQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((range) => range.to >= range.from, {
    path: ["to"],
    message: "Must not be before the start date",
  });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateBarberInput = z.infer<typeof createBarberSchema>;
export type UpdateBarberInput = z.infer<typeof updateBarberSchema>;
export type WorkingHoursInput = z.infer<typeof workingHoursSchema>;
