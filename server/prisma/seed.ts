import { hashPassword } from "../src/auth/password.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type {
  Barber,
  BookingStatus,
  Service,
  User,
} from "../src/generated/prisma/client.ts";
import {
  addDays,
  shopDateOf,
  shopTimeToUtc,
  toDateColumn,
  weekdayOf,
} from "../src/shop/time.ts";

const SUNDAY = 0;
const MONDAY = 1;
const TUESDAY = 2;
const WEDNESDAY = 3;
const THURSDAY = 4;
const FRIDAY = 5;
const SATURDAY = 6;

function minutes(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

// Demo bookings are placed relative to today so the data never looks stale.
// "Today" and every clock time below are in the shop's time zone, whatever
// time zone this machine is in.
const timeZone = env.shopTimeZone;
const today = shopDateOf(new Date(), timeZone);

// The first date, counting from today, that falls on one of the weekdays.
// A negative number searches backwards.
function findWorkday(weekdays: number[], daysFromToday: number): string {
  const step = daysFromToday < 0 ? -1 : 1;
  let shopDate = addDays(today, daysFromToday);
  while (!weekdays.includes(weekdayOf(shopDate))) {
    shopDate = addDays(shopDate, step);
  }
  return shopDate;
}

function at(shopDate: string, hour: number, minute = 0): Date {
  return shopTimeToUtc(shopDate, minutes(hour, minute), timeZone);
}

function bookingData(
  customer: User,
  barber: Barber,
  service: Service,
  startsAt: Date,
  status: BookingStatus,
) {
  return {
    customerId: customer.id,
    barberId: barber.id,
    serviceId: service.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
    status,
    priceCents: service.priceCents,
    depositCents: service.depositCents,
  };
}

async function seed() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("Missing environment variable SEED_PASSWORD. See .env.example.");
  }
  const passwordHash = await hashPassword(seedPassword);

  // Bookings go first because they block deleting the rows they point at.
  // Deleting users cascades to barbers, working hours, and days off.
  await prisma.booking.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      email: "tamar@dalaki.example",
      name: "Tamar Beridze",
      role: "ADMIN",
      passwordHash,
    },
  });

  const giorgiWeekdays = [TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY];
  const giorgi = await prisma.barber.create({
    data: {
      bio: "Opened Dalaki in 2016 after ten years in shops across Vake and Sololaki. Scissor cuts and straight razor shaves are what he is known for.",
      user: {
        create: {
          email: "giorgi@dalaki.example",
          name: "Giorgi Kapanadze",
          role: "BARBER",
          passwordHash,
        },
      },
      workingHours: {
        create: giorgiWeekdays.map((weekday) => ({
          weekday,
          startMinute: minutes(10),
          endMinute: minutes(19),
          breakStartMinute: minutes(14),
          breakEndMinute: minutes(15),
        })),
      },
    },
  });

  const lukaWeekdays = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY];
  const luka = await prisma.barber.create({
    data: {
      bio: "Fades, tapers and sharp beard lines. Luka knows what the city is wearing and how to make it suit you.",
      user: {
        create: {
          email: "luka@dalaki.example",
          name: "Luka Gelashvili",
          role: "BARBER",
          passwordHash,
        },
      },
      workingHours: {
        create: lukaWeekdays.map((weekday) => ({
          weekday,
          startMinute: minutes(11),
          endMinute: minutes(20),
          breakStartMinute: minutes(15),
          breakEndMinute: minutes(15, 30),
        })),
      },
    },
  });

  // Part-time, short days, no break.
  const nikaWeekdays = [THURSDAY, FRIDAY, SATURDAY, SUNDAY];
  const nika = await prisma.barber.create({
    data: {
      bio: "Takes the weekend chair. Patient with first haircuts and with children who would rather be anywhere else.",
      user: {
        create: {
          email: "nika@dalaki.example",
          name: "Nika Tsiklauri",
          role: "BARBER",
          passwordHash,
        },
      },
      workingHours: {
        create: nikaWeekdays.map((weekday) => ({
          weekday,
          startMinute: minutes(12),
          endMinute: minutes(18),
        })),
      },
    },
  });

  // Prices are in tetri (1 GEL = 100 tetri), so 4500 is 45 GEL.
  const haircut = await prisma.service.create({
    data: {
      name: "Haircut",
      description: "Scissor or clipper cut with a wash and style to finish.",
      durationMinutes: 45,
      priceCents: 4500,
      depositCents: 1500,
    },
  });
  const beardTrim = await prisma.service.create({
    data: {
      name: "Beard trim",
      description: "Shaped and lined up with a razor, finished with beard oil.",
      durationMinutes: 30,
      priceCents: 2500,
      depositCents: 1000,
    },
  });
  const haircutAndBeard = await prisma.service.create({
    data: {
      name: "Haircut and beard",
      description: "The full visit: haircut, beard trim, wash and style.",
      durationMinutes: 75,
      priceCents: 6500,
      depositCents: 2000,
    },
  });
  const hotTowelShave = await prisma.service.create({
    data: {
      name: "Hot towel shave",
      description: "A straight razor shave with hot towels before and after.",
      durationMinutes: 30,
      priceCents: 3500,
      depositCents: 1000,
    },
  });
  const kidsHaircut = await prisma.service.create({
    data: {
      name: "Kids haircut",
      description: "For children under twelve. No rush, no tears.",
      durationMinutes: 30,
      priceCents: 3000,
      depositCents: 1000,
    },
  });

  // The phone numbers are deliberately fictional.
  const davit = await prisma.user.create({
    data: {
      email: "davit@dalaki.example",
      name: "Davit Maisuradze",
      phone: "+995 555 01 01 01",
      passwordHash,
    },
  });
  const nino = await prisma.user.create({
    data: {
      email: "nino@dalaki.example",
      name: "Nino Lomidze",
      phone: "+995 555 01 01 02",
      passwordHash,
    },
  });
  const irakli = await prisma.user.create({
    data: {
      email: "irakli@dalaki.example",
      name: "Irakli Mchedlishvili",
      passwordHash,
    },
  });

  await prisma.dayOff.create({
    data: {
      barberId: giorgi.id,
      date: toDateColumn(findWorkday(giorgiWeekdays, 10)),
      reason: "Family event",
    },
  });

  const giorgiLastWorkday = findWorkday(giorgiWeekdays, -1);
  // Two days out, so the cancellation below is inside the free window.
  const giorgiNextWorkday = findWorkday(giorgiWeekdays, 2);
  const lukaEarlierWorkday = findWorkday(lukaWeekdays, -3);
  const lukaNextWorkday = findWorkday(lukaWeekdays, 2);
  const nikaNextWorkday = findWorkday(nikaWeekdays, 3);

  await prisma.booking.createMany({
    data: [
      bookingData(davit, giorgi, haircut, at(giorgiLastWorkday, 11), "COMPLETED"),
      bookingData(irakli, giorgi, beardTrim, at(giorgiLastWorkday, 12), "NO_SHOW"),
      bookingData(irakli, luka, haircutAndBeard, at(lukaEarlierWorkday, 16), "COMPLETED"),

      // Irakli cancelled, then Davit took the same slot. Both rows can exist
      // because cancelled bookings are outside the overlap constraint.
      {
        ...bookingData(irakli, giorgi, haircut, at(giorgiNextWorkday, 11), "CANCELLED"),
        cancelledAt: new Date(),
        cancelledInFreeWindow: true,
      },
      bookingData(davit, giorgi, haircut, at(giorgiNextWorkday, 11), "CONFIRMED"),
      // Back to back with the booking above: one ends at 11:45, this starts at 11:45.
      bookingData(irakli, giorgi, beardTrim, at(giorgiNextWorkday, 11, 45), "CONFIRMED"),

      bookingData(irakli, luka, hotTowelShave, at(lukaNextWorkday, 12), "PENDING"),
      bookingData(nino, nika, kidsHaircut, at(nikaNextWorkday, 13), "CONFIRMED"),
    ],
  });

  console.log(
    "Seeded 1 admin, 3 barbers, 3 customers, 5 services, 1 day off, 8 bookings.",
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
