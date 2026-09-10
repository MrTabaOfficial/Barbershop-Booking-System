import { hashPassword } from "../src/auth/password.ts";
import { prisma } from "../src/db.ts";
import type {
  Barber,
  BookingStatus,
  Service,
  User,
} from "../src/generated/prisma/client.ts";

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
// The seed treats this machine's local time as the shop's local time.
function findWorkday(weekdays: number[], daysFromToday: number): Date {
  const step = daysFromToday < 0 ? -1 : 1;
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + daysFromToday);
  while (!weekdays.includes(day.getDay())) {
    day.setDate(day.getDate() + step);
  }
  return day;
}

function at(day: Date, hour: number, minute = 0): Date {
  const time = new Date(day);
  time.setHours(hour, minute, 0, 0);
  return time;
}

// A DATE column keeps only the UTC calendar date of the value it is given,
// so local midnight would land on the previous day in timezones ahead of UTC.
function toDateOnly(day: Date): Date {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
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
      email: "admin@barbershop.test",
      name: "Olivia Bennett",
      role: "ADMIN",
      passwordHash,
    },
  });

  const marcoWeekdays = [TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY];
  const marco = await prisma.barber.create({
    data: {
      bio: "Classic cuts and hot towel shaves. Fifteen years behind the chair.",
      user: {
        create: {
          email: "marco@barbershop.test",
          name: "Marco Rossi",
          role: "BARBER",
          passwordHash,
        },
      },
      workingHours: {
        create: marcoWeekdays.map((weekday) => ({
          weekday,
          startMinute: minutes(9),
          endMinute: minutes(18),
          breakStartMinute: minutes(13),
          breakEndMinute: minutes(14),
        })),
      },
    },
  });

  const devWeekdays = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY];
  const dev = await prisma.barber.create({
    data: {
      bio: "Fades, tapers, and sharp beard work.",
      user: {
        create: {
          email: "dev@barbershop.test",
          name: "Dev Patel",
          role: "BARBER",
          passwordHash,
        },
      },
      workingHours: {
        create: devWeekdays.map((weekday) => ({
          weekday,
          startMinute: minutes(10),
          endMinute: minutes(19),
          breakStartMinute: minutes(14),
          breakEndMinute: minutes(14, 30),
        })),
      },
    },
  });

  // Part-time, short days, no break.
  const samWeekdays = [THURSDAY, FRIDAY, SATURDAY, SUNDAY];
  const sam = await prisma.barber.create({
    data: {
      bio: "Weekend specialist. Great with kids' first haircuts.",
      user: {
        create: {
          email: "sam@barbershop.test",
          name: "Sam Okafor",
          role: "BARBER",
          passwordHash,
        },
      },
      workingHours: {
        create: samWeekdays.map((weekday) => ({
          weekday,
          startMinute: minutes(11),
          endMinute: minutes(17),
        })),
      },
    },
  });

  const haircut = await prisma.service.create({
    data: {
      name: "Haircut",
      description: "Scissor or clipper cut, finished with a wash and style.",
      durationMinutes: 30,
      priceCents: 2500,
      depositCents: 1000,
    },
  });
  const beardTrim = await prisma.service.create({
    data: {
      name: "Beard trim",
      description: "Shape, line-up, and beard oil.",
      durationMinutes: 15,
      priceCents: 1500,
      depositCents: 500,
    },
  });
  const haircutAndBeard = await prisma.service.create({
    data: {
      name: "Haircut & beard",
      description: "Full haircut plus beard trim.",
      durationMinutes: 45,
      priceCents: 3500,
      depositCents: 1000,
    },
  });
  const hotTowelShave = await prisma.service.create({
    data: {
      name: "Hot towel shave",
      description: "Straight razor shave with hot towels.",
      durationMinutes: 30,
      priceCents: 3000,
      depositCents: 1000,
    },
  });
  const kidsHaircut = await prisma.service.create({
    data: {
      name: "Kids haircut",
      description: "For children under 12.",
      durationMinutes: 30,
      priceCents: 1800,
      depositCents: 500,
    },
  });

  const alex = await prisma.user.create({
    data: {
      email: "alex@example.test",
      name: "Alex Turner",
      phone: "+1 555 0101",
      passwordHash,
    },
  });
  const priya = await prisma.user.create({
    data: {
      email: "priya@example.test",
      name: "Priya Shah",
      phone: "+1 555 0102",
      passwordHash,
    },
  });
  const jordan = await prisma.user.create({
    data: {
      email: "jordan@example.test",
      name: "Jordan Lee",
      passwordHash,
    },
  });

  await prisma.dayOff.create({
    data: {
      barberId: marco.id,
      date: toDateOnly(findWorkday(marcoWeekdays, 10)),
      reason: "Family event",
    },
  });

  const marcoLastWorkday = findWorkday(marcoWeekdays, -1);
  const marcoNextWorkday = findWorkday(marcoWeekdays, 1);
  const devEarlierWorkday = findWorkday(devWeekdays, -3);
  const devNextWorkday = findWorkday(devWeekdays, 2);
  const samNextWorkday = findWorkday(samWeekdays, 3);

  await prisma.booking.createMany({
    data: [
      bookingData(alex, marco, haircut, at(marcoLastWorkday, 10), "COMPLETED"),
      bookingData(priya, marco, beardTrim, at(marcoLastWorkday, 11), "NO_SHOW"),
      bookingData(jordan, dev, haircutAndBeard, at(devEarlierWorkday, 15), "COMPLETED"),

      // Priya cancelled, then Alex took the same slot. Both rows can exist
      // because cancelled bookings are outside the overlap constraint.
      bookingData(priya, marco, haircut, at(marcoNextWorkday, 10), "CANCELLED"),
      bookingData(alex, marco, haircut, at(marcoNextWorkday, 10), "CONFIRMED"),
      // Back to back with the booking above: one ends at 10:30, this starts at 10:30.
      bookingData(jordan, marco, beardTrim, at(marcoNextWorkday, 10, 30), "CONFIRMED"),

      bookingData(jordan, dev, hotTowelShave, at(devNextWorkday, 11), "PENDING"),
      bookingData(priya, sam, kidsHaircut, at(samNextWorkday, 12), "CONFIRMED"),
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
