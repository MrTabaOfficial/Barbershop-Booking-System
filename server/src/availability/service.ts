import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import type { Service } from "../generated/prisma/client.ts";
import { shopTimeToUtc, toDateColumn, weekdayOf } from "../shop/time.ts";
import { calculateSlots } from "./slots.ts";

export async function getActiveService(serviceId: string): Promise<Service> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, isActive: true },
  });
  if (!service) {
    throw new AppError(404, "SERVICE_NOT_FOUND", "This service is not available");
  }
  return service;
}

type SlotQuery = {
  barberId: string;
  shopDate: string;
  durationMinutes: number;
  // When rescheduling, the booking being moved must not block its own slot.
  ignoreBookingId?: string;
};

// Loads everything the slot calculation needs for one barber and one day,
// then hands it to the pure function.
export async function findAvailableSlots(query: SlotQuery): Promise<Date[]> {
  const { barberId, shopDate } = query;
  const timeZone = env.shopTimeZone;

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, isActive: true },
  });
  if (!barber) {
    throw new AppError(404, "BARBER_NOT_FOUND", "This barber is not available");
  }

  const dayStart = shopTimeToUtc(shopDate, 0, timeZone);
  const dayEnd = shopTimeToUtc(shopDate, 24 * 60, timeZone);

  const [workingHours, dayOff, bookings] = await Promise.all([
    prisma.workingHours.findUnique({
      where: { barberId_weekday: { barberId, weekday: weekdayOf(shopDate) } },
    }),
    prisma.dayOff.findUnique({
      where: { barberId_date: { barberId, date: toDateColumn(shopDate) } },
    }),
    // Every booking that touches this day, including one that started the
    // evening before.
    prisma.booking.findMany({
      where: {
        barberId,
        id: { not: query.ignoreBookingId },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
  ]);

  return calculateSlots({
    shopDate,
    timeZone,
    now: new Date(),
    workingHours,
    isDayOff: dayOff !== null,
    durationMinutes: query.durationMinutes,
    bookings,
  });
}
