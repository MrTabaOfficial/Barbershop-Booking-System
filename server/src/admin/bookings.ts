import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import { FREE_CANCELLATION_HOURS } from "../bookings/rules.ts";
import type { Dependencies } from "../dependencies.ts";
import type { BookingStatus, Prisma } from "../generated/prisma/client.ts";
import { notifyBookingCancelled } from "../notifications/service.ts";
import { settleCancelledBooking } from "../payments/service.ts";
import { shopTimeToUtc } from "../shop/time.ts";
import type { BookingFilter, BookingListQuery } from "./schemas.ts";

export const MAX_EXPORT_ROWS = 10_000;

const adminBookingDetails = {
  customer: true,
  service: true,
  barber: { include: { user: true } },
} satisfies Prisma.BookingInclude;

export type AdminBooking = Prisma.BookingGetPayload<{ include: typeof adminBookingDetails }>;

function toWhere(filter: BookingFilter): Prisma.BookingWhereInput {
  const timeZone = env.shopTimeZone;
  const contains = filter.search && { contains: filter.search, mode: "insensitive" as const };
  return {
    barberId: filter.barberId,
    status: filter.status?.toUpperCase() as BookingStatus | undefined,
    startsAt: {
      gte: filter.from ? shopTimeToUtc(filter.from, 0, timeZone) : undefined,
      lt: filter.to ? shopTimeToUtc(filter.to, 24 * 60, timeZone) : undefined,
    },
    customer: contains
      ? { OR: [{ name: contains }, { email: contains }, { phone: contains }] }
      : undefined,
  };
}

function toOrderBy(filter: BookingFilter): Prisma.BookingOrderByWithRelationInput[] {
  const { order } = filter;
  const primary: Record<BookingFilter["sort"], Prisma.BookingOrderByWithRelationInput> = {
    startsAt: { startsAt: order },
    customer: { customer: { name: order } },
    barber: { barber: { user: { name: order } } },
    service: { service: { name: order } },
    status: { status: order },
    price: { priceCents: order },
  };
  // The extra keys settle ties the same way every time; without them, rows
  // with equal values could swap places between two pages.
  return [primary[filter.sort], { startsAt: "desc" }, { id: "asc" }];
}

export async function listBookings(query: BookingListQuery) {
  const where = toWhere(query);
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: adminBookingDetails,
      orderBy: toOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.booking.count({ where }),
  ]);
  return { bookings, total };
}

export function findBookingsForExport(filter: BookingFilter): Promise<AdminBooking[]> {
  return prisma.booking.findMany({
    where: toWhere(filter),
    include: adminBookingDetails,
    orderBy: toOrderBy(filter),
    take: MAX_EXPORT_ROWS,
  });
}

export async function cancelBookingAsAdmin(
  deps: Dependencies,
  bookingId: string,
  refund: boolean,
): Promise<AdminBooking> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new AppError(
      409,
      "BOOKING_NOT_ACTIVE",
      `This booking is ${booking.status.toLowerCase().replace("_", " ")} and can't be cancelled`,
    );
  }

  const now = new Date();
  const hoursUntilStart = (booking.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  const result = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledInFreeWindow: hoursUntilStart >= FREE_CANCELLATION_HOURS,
      holdExpiresAt: null,
    },
  });
  if (result.count === 0) {
    throw new AppError(
      409,
      "BOOKING_CHANGED",
      "This booking was changed a moment ago. Reload it and try again.",
    );
  }

  await settleCancelledBooking(deps.payments, booking, refund);

  if (booking.status === "CONFIRMED") {
    await notifyBookingCancelled(deps, booking.id, "shop");
  }

  return prisma.booking.findUniqueOrThrow({
    where: { id: booking.id },
    include: adminBookingDetails,
  });
}
