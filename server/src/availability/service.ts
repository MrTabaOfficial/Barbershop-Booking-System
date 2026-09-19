import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import { expireUnpaidBookings } from "../payments/service.ts";
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

// Someone else's booking id is ignored rather than refused, so it can neither
// free up another customer's slot nor reveal which ids exist.
export async function findOwnBookingId(
  bookingId: string | undefined,
  userId: string | undefined,
): Promise<string | undefined> {
  if (!bookingId || !userId) {
    return undefined;
  }
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: userId },
    select: { id: true },
  });
  return booking?.id;
}

type SlotQuery = {
  barberId: string;
  shopDate: string;
  durationMinutes: number;
  ignoreBookingId?: string;
};

export async function findAvailableSlots(query: SlotQuery): Promise<Date[]> {
  const { barberId, shopDate } = query;
  const timeZone = env.shopTimeZone;

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, isActive: true },
  });
  if (!barber) {
    throw new AppError(404, "BARBER_NOT_FOUND", "This barber is not available");
  }

  await expireUnpaidBookings();

  const dayStart = shopTimeToUtc(shopDate, 0, timeZone);
  const dayEnd = shopTimeToUtc(shopDate, 24 * 60, timeZone);

  const [workingHours, dayOff, bookings] = await Promise.all([
    prisma.workingHours.findUnique({
      where: { barberId_weekday: { barberId, weekday: weekdayOf(shopDate) } },
    }),
    prisma.dayOff.findUnique({
      where: { barberId_date: { barberId, date: toDateColumn(shopDate) } },
    }),
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
