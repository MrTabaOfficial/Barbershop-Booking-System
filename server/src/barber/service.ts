import { isUniqueViolation, prisma } from "../db.ts";
import { env } from "../env.ts";
import { RELEASED_STATUSES } from "../bookings/status.ts";
import { AppError } from "../errors.ts";
import type { Barber, Prisma } from "../generated/prisma/client.ts";
import {
  addDays,
  daysBetween,
  formatShopDate,
  fromDateColumn,
  shopClockTimeOf,
  shopDateOf,
  shopTimeToUtc,
  toDateColumn,
  weekdayOf,
} from "../shop/time.ts";
import { type AddDayOffInput, MAX_SCHEDULE_DAYS } from "./schemas.ts";

const MAX_DAY_OFF_DAYS_AHEAD = 365;

const scheduleBookingDetails = {
  customer: true,
  service: true,
} satisfies Prisma.BookingInclude;

export type ScheduleBooking = Prisma.BookingGetPayload<{
  include: typeof scheduleBookingDetails;
}>;

export async function getBarberOf(userId: string): Promise<Barber> {
  const barber = await prisma.barber.findUnique({ where: { userId } });
  if (!barber) {
    throw new AppError(403, "FORBIDDEN", "This account has no barber profile");
  }
  return barber;
}

function invalidField(path: string, message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", "The request is not valid", [{ path, message }]);
}

export async function getSchedule(barber: Barber, from: string, to: string) {
  if (daysBetween(from, to) >= MAX_SCHEDULE_DAYS) {
    throw invalidField("to", `A schedule covers at most ${MAX_SCHEDULE_DAYS} days`);
  }
  const timeZone = env.shopTimeZone;

  const [workingHours, daysOff, bookings] = await Promise.all([
    prisma.workingHours.findMany({ where: { barberId: barber.id } }),
    prisma.dayOff.findMany({
      where: { barberId: barber.id, date: { gte: toDateColumn(from), lte: toDateColumn(to) } },
    }),
    prisma.booking.findMany({
      where: {
        barberId: barber.id,
        status: { notIn: [...RELEASED_STATUSES] },
        startsAt: {
          gte: shopTimeToUtc(from, 0, timeZone),
          lt: shopTimeToUtc(to, 24 * 60, timeZone),
        },
      },
      include: scheduleBookingDetails,
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    days.push({
      date,
      workingHours: workingHours.find((hours) => hours.weekday === weekday) ?? null,
      dayOff: daysOff.find((dayOff) => fromDateColumn(dayOff.date) === date) ?? null,
      bookings: bookings.filter((booking) => shopDateOf(booking.startsAt, timeZone) === date),
    });
  }
  return days;
}

export async function recordOutcome(
  barber: Barber,
  bookingId: string,
  outcome: "COMPLETED" | "NO_SHOW",
): Promise<ScheduleBooking> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, barberId: barber.id },
  });
  if (!booking) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }
  if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
    throw new AppError(409, "BOOKING_NOT_ACTIVE", "This booking was cancelled");
  }
  if (booking.status === "PENDING") {
    throw new AppError(
      409,
      "BOOKING_NOT_ACTIVE",
      "This booking's deposit hasn't been paid, so it isn't confirmed",
    );
  }
  if (booking.startsAt > new Date()) {
    throw new AppError(
      409,
      "BOOKING_NOT_STARTED",
      "This appointment hasn't started yet, so there is no outcome to record",
    );
  }

  const result = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status },
    data: { status: outcome },
  });
  if (result.count === 0) {
    throw new AppError(
      409,
      "BOOKING_CHANGED",
      "This booking was changed a moment ago. Reload it and try again.",
    );
  }

  return prisma.booking.findUniqueOrThrow({
    where: { id: booking.id },
    include: scheduleBookingDetails,
  });
}

export async function listUpcomingDaysOff(barber: Barber) {
  const today = shopDateOf(new Date(), env.shopTimeZone);
  return prisma.dayOff.findMany({
    where: { barberId: barber.id, date: { gte: toDateColumn(today) } },
    orderBy: { date: "asc" },
  });
}

export async function addDayOff(barber: Barber, input: AddDayOffInput) {
  const timeZone = env.shopTimeZone;
  const today = shopDateOf(new Date(), timeZone);
  if (input.date < today) {
    throw invalidField("date", "Choose today or a later date");
  }
  if (daysBetween(today, input.date) > MAX_DAY_OFF_DAYS_AHEAD) {
    throw invalidField("date", "Choose a date within the next year");
  }

  const bookings = await prisma.booking.findMany({
    where: {
      barberId: barber.id,
      status: { notIn: [...RELEASED_STATUSES] },
      startsAt: {
        gte: shopTimeToUtc(input.date, 0, timeZone),
        lt: shopTimeToUtc(input.date, 24 * 60, timeZone),
      },
    },
    include: scheduleBookingDetails,
    orderBy: { startsAt: "asc" },
  });
  if (bookings.length > 0) {
    const count = bookings.length === 1 ? "1 booking" : `${bookings.length} bookings`;
    throw new AppError(
      409,
      "DAY_HAS_BOOKINGS",
      `You have ${count} on ${formatShopDate(input.date)}. ${bookings.length === 1 ? "It has" : "They have"} to be moved or cancelled before you can take the day off.`,
      {
        bookings: bookings.map((booking) => ({
          id: booking.id,
          localTime: shopClockTimeOf(booking.startsAt, timeZone),
          customerName: booking.customer.name,
          serviceName: booking.service.name,
        })),
      },
    );
  }

  try {
    return await prisma.dayOff.create({
      data: { barberId: barber.id, date: toDateColumn(input.date), reason: input.reason },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "DAY_OFF_EXISTS", "You already have that day off");
    }
    throw error;
  }
}

export async function removeDayOff(barber: Barber, dayOffId: string): Promise<void> {
  const result = await prisma.dayOff.deleteMany({
    where: { id: dayOffId, barberId: barber.id },
  });
  if (result.count === 0) {
    throw new AppError(404, "DAY_OFF_NOT_FOUND", "Day off not found");
  }
}
