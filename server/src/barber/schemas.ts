import { z } from "zod";

export const MAX_SCHEDULE_DAYS = 31;

export const scheduleQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((range) => range.to >= range.from, {
    path: ["to"],
    message: "Must not be before the start date",
  });

export const addDayOffSchema = z.object({
  date: z.iso.date(),
  reason: z.string().trim().min(1).max(200).optional(),
});

export const idParamsSchema = z.object({ id: z.uuid() });

export type AddDayOffInput = z.infer<typeof addDayOffSchema>;
