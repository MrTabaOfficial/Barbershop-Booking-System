import { hashPassword } from "../src/auth/password.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type {
  Barber,
  BookingStatus,
  PaymentStatus,
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

const HOUR_MS = 60 * 60 * 1000;

function minutes(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

const timeZone = env.shopTimeZone;
const today = shopDateOf(new Date(), timeZone);

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

type Shift = {
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  breakStartMinute?: number;
  breakEndMinute?: number;
};

function workingHoursRows({ weekdays, ...hours }: Shift) {
  return weekdays.map((weekday) => ({ weekday, ...hours }));
}

let seededPayments = 0;

function bookingData(
  customer: User,
  barber: Barber,
  service: Service,
  startsAt: Date,
  status: BookingStatus,
) {
  seededPayments += 1;
  return {
    customerId: customer.id,
    barberId: barber.id,
    serviceId: service.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
    status,
    priceCents: service.priceCents,
    depositCents: service.depositCents,
    paymentStatus: "PAID" as PaymentStatus,
    paymentId: `seed_pay_${seededPayments}`,
    paymentProvider: "fake",
  };
}

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const HISTORY_DAYS = 84;
const GAPS_BETWEEN_BOOKINGS = [0, 0, 15, 30, 45, 60, 90];
const REGULAR_VISIT_EVERY_DAYS = 12;
const GENERATED_CUSTOMERS = 240;

const FIRST_NAMES = [
  "Aleksandre", "Andria", "Archil", "Bachana", "Beka", "Demetre", "Gela", "Giga", "Goga",
  "Guram", "Ilia", "Ioane", "Jaba", "Kakha", "Koba", "Lasha", "Mamuka", "Mikheil", "Nodar",
  "Otar", "Rati", "Revaz", "Shota", "Soso", "Tamaz", "Temur", "Vakhtang", "Vano", "Zaza",
  "Zurab", "Mariam", "Ketevan", "Salome", "Natia", "Eka", "Maia",
];
const LAST_NAMES = [
  "Abashidze", "Chkheidze", "Dolidze", "Japaridze", "Kvaratskhelia", "Mamaladze", "Nozadze",
  "Okruashvili", "Pirtskhalava", "Rukhadze", "Shengelia", "Tabatadze", "Tsereteli",
  "Vashakidze", "Zhvania", "Kiknadze", "Kobakhidze", "Meskhi", "Natsvlishvili",
  "Sikharulidze", "Chanturia", "Gabunia", "Jorjoliani", "Kalandadze", "Lortkipanidze",
  "Makharadze", "Gvasalia", "Bakradze", "Tevzadze", "Khvichia",
];

function generateCustomers(count: number) {
  const random = createRandom(1905);
  const taken = new Set<string>();
  const customers: { name: string; email: string; phone?: string }[] = [];
  while (customers.length < count) {
    const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const email = `${first}.${last}@dalaki.example`.toLowerCase();
    if (!first || !last || taken.has(email)) {
      continue;
    }
    taken.add(email);
    const digits = String(100_000 + customers.length);
    const phone = `+995 555 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    customers.push({ name: `${first} ${last}`, email, phone: random() < 0.7 ? phone : undefined });
  }
  return customers;
}

function generateHistory(
  chairs: { barber: Barber; shift: Shift }[],
  services: Service[],
  customers: User[],
  regular: User,
) {
  const random = createRandom(2016);
  const pick = <Item>(items: Item[]): Item => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) {
      throw new Error("Can't pick from an empty list");
    }
    return item;
  };

  const visitors = customers.map((customer) => {
    const everyDays =
      customer.id === regular.id ? REGULAR_VISIT_EVERY_DAYS : 14 + Math.floor(random() * 15);
    return { customer, everyDays, nextVisit: -HISTORY_DAYS + Math.floor(random() * everyDays) };
  });

  const bookings = [];
  for (let offset = -HISTORY_DAYS; offset <= 0; offset++) {
    const shopDate = addDays(today, offset);
    const weekday = weekdayOf(shopDate);

    const waiting = visitors
      .filter((visitor) => visitor.nextVisit <= offset)
      .sort(() => random() - 0.5)
      .sort((a, b) => Number(b.customer.id === regular.id) - Number(a.customer.id === regular.id));
    let open = chairs
      .filter(({ shift }) => shift.weekdays.includes(weekday))
      .map(({ barber, shift }) => ({ barber, shift, cursor: shift.startMinute + pick([0, 15, 30]) }));

    while (open.length > 0 && waiting.length > 0) {
      for (const chair of open) {
        const visitor = waiting[0];
        if (!visitor) {
          break;
        }
        const { shift } = chair;
        const service = pick(services);
        if (
          shift.breakStartMinute !== undefined &&
          shift.breakEndMinute !== undefined &&
          chair.cursor < shift.breakEndMinute &&
          chair.cursor + service.durationMinutes > shift.breakStartMinute
        ) {
          chair.cursor = shift.breakEndMinute;
        }
        if (chair.cursor + service.durationMinutes > shift.endMinute) {
          open = open.filter((other) => other !== chair);
          continue;
        }

        waiting.shift();
        visitor.nextVisit = offset + visitor.everyDays;
        const startsAt = shopTimeToUtc(shopDate, chair.cursor, timeZone);
        const booking = bookingData(visitor.customer, chair.barber, service, startsAt, "CONFIRMED");

        if (offset === 0) {
          bookings.push(booking);
          chair.cursor += service.durationMinutes;
        } else {
          const roll = random();
          if (roll < 0.1) {
            const cancelledLate = random() < 0.3;
            bookings.push({
              ...booking,
              status: "CANCELLED" as const,
              cancelledAt: new Date(startsAt.getTime() - (cancelledLate ? 6 : 48) * HOUR_MS),
              cancelledInFreeWindow: !cancelledLate,
              paymentStatus: cancelledLate ? ("PAID" as const) : ("REFUNDED" as const),
            });
          } else {
            bookings.push({
              ...booking,
              status: roll < 0.18 ? ("NO_SHOW" as const) : ("COMPLETED" as const),
            });
            chair.cursor += service.durationMinutes;
          }
        }
        chair.cursor += pick(GAPS_BETWEEN_BOOKINGS);
      }
    }
  }
  return bookings;
}

async function seed() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("Missing environment variable SEED_PASSWORD. See .env.example.");
  }
  const passwordHash = await hashPassword(seedPassword);

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

  const giorgiShift: Shift = {
    weekdays: [TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY],
    startMinute: minutes(10),
    endMinute: minutes(19),
    breakStartMinute: minutes(14),
    breakEndMinute: minutes(15),
  };
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
      workingHours: { create: workingHoursRows(giorgiShift) },
    },
  });

  const lukaShift: Shift = {
    weekdays: [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],
    startMinute: minutes(11),
    endMinute: minutes(20),
    breakStartMinute: minutes(15),
    breakEndMinute: minutes(15, 30),
  };
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
      workingHours: { create: workingHoursRows(lukaShift) },
    },
  });

  const nikaShift: Shift = {
    weekdays: [THURSDAY, FRIDAY, SATURDAY, SUNDAY],
    startMinute: minutes(12),
    endMinute: minutes(18),
  };
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
      workingHours: { create: workingHoursRows(nikaShift) },
    },
  });

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

  const customers = await prisma.user.createManyAndReturn({
    data: [
      { name: "Davit Maisuradze", email: "davit@dalaki.example", phone: "+995 555 01 01 01" },
      { name: "Nino Lomidze", email: "nino@dalaki.example", phone: "+995 555 01 01 02" },
      { name: "Irakli Mchedlishvili", email: "irakli@dalaki.example" },
      { name: "Levan Giorgadze", email: "levan@dalaki.example", phone: "+995 555 01 01 04" },
      { name: "Tornike Khutsishvili", email: "tornike@dalaki.example", phone: "+995 555 01 01 05" },
      { name: "Ana Gogoladze", email: "ana@dalaki.example", phone: "+995 555 01 01 06" },
      { name: "Saba Bolkvadze", email: "saba@dalaki.example" },
      ...generateCustomers(GENERATED_CUSTOMERS),
    ].map((customer) => ({ ...customer, passwordHash })),
  });
  const [davit, nino, irakli, levan] = customers;
  if (!davit || !nino || !irakli || !levan) {
    throw new Error("The demo customers were not created");
  }

  await prisma.dayOff.create({
    data: {
      barberId: giorgi.id,
      date: toDateColumn(findWorkday(giorgiShift.weekdays, 10)),
      reason: "Family event",
    },
  });

  const giorgiNextWorkday = findWorkday(giorgiShift.weekdays, 2);
  const lukaNextWorkday = findWorkday(lukaShift.weekdays, 2);
  const nikaNextWorkday = findWorkday(nikaShift.weekdays, 3);

  const upcoming = [
    {
      ...bookingData(irakli, giorgi, haircut, at(giorgiNextWorkday, 11), "CANCELLED"),
      cancelledAt: new Date(),
      cancelledInFreeWindow: true,
      paymentStatus: "REFUNDED" as const,
    },
    bookingData(davit, giorgi, haircut, at(giorgiNextWorkday, 11), "CONFIRMED"),
    bookingData(irakli, giorgi, beardTrim, at(giorgiNextWorkday, 11, 45), "CONFIRMED"),

    bookingData(levan, luka, hotTowelShave, at(lukaNextWorkday, 12), "CONFIRMED"),
    bookingData(nino, nika, kidsHaircut, at(nikaNextWorkday, 13), "CONFIRMED"),
  ];

  const history = generateHistory(
    [
      { barber: giorgi, shift: giorgiShift },
      { barber: luka, shift: lukaShift },
      { barber: nika, shift: nikaShift },
    ],
    [haircut, beardTrim, haircutAndBeard, hotTowelShave, kidsHaircut],
    customers,
    davit,
  );

  await prisma.booking.createMany({ data: [...upcoming, ...history] });

  console.log(
    `Seeded 1 admin, 3 barbers, ${customers.length} customers, 5 services, 1 day off, ` +
      `${upcoming.length} upcoming bookings and ${history.length} from the last ${HISTORY_DAYS} days and today.`,
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
