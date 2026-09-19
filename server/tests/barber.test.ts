import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type { Barber, BookingStatus, Service, User } from "../src/generated/prisma/client.ts";
import { addDays, shopDateOf, shopTimeToUtc, toDateColumn } from "../src/shop/time.ts";
import {
  authHeaderFor,
  authHeaderForBarber,
  createBarber,
  createService,
  createUser,
  resetDatabase,
} from "./helpers.ts";

const HOUR_MS = 60 * 60 * 1000;
const TODAY = shopDateOf(new Date(), env.shopTimeZone);
const NEXT_WEEK = addDays(TODAY, 7);

function at(shopDate: string, clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return shopTimeToUtc(shopDate, (hours ?? 0) * 60 + (minutes ?? 0), env.shopTimeZone);
}

let app: Express;
let giorgi: Barber;
let luka: Barber;
let haircut: Service;
let davit: User;
let giorgiAuth: string;
let lukaAuth: string;
let davitAuth: string;

beforeEach(async () => {
  await resetDatabase();
  app = createApp();
  giorgi = await createBarber("Giorgi Kapanadze");
  luka = await createBarber("Luka Gelashvili");
  haircut = await createService("Haircut");
  davit = await prisma.user.update({
    where: { id: (await createUser("davit@dalaki.example")).id },
    data: { name: "Davit Maisuradze", phone: "+995 555 01 01 01" },
  });
  giorgiAuth = await authHeaderForBarber(giorgi);
  lukaAuth = await authHeaderForBarber(luka);
  davitAuth = await authHeaderFor(davit);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function insertBooking(barber: Barber, startsAt: Date, status: BookingStatus = "CONFIRMED") {
  return prisma.booking.create({
    data: {
      customerId: davit.id,
      barberId: barber.id,
      serviceId: haircut.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status,
      priceCents: haircut.priceCents,
      depositCents: haircut.depositCents,
    },
  });
}

const anHourAgo = () => new Date(Date.now() - HOUR_MS);

function getSchedule(auth: string, from: string, to: string) {
  return request(app).get("/barber/schedule").query({ from, to }).set("Authorization", auth);
}

function addDayOff(auth: string, date: string, reason?: string) {
  return request(app).post("/barber/days-off").set("Authorization", auth).send({ date, reason });
}

describe("who may use the barber endpoints", () => {
  const SOME_ID = "7b1d7d0e-3c0a-4f6e-9d55-2f0c1a9e4b11";
  const endpoints = [
    ["get", "/barber/schedule?from=2026-10-06&to=2026-10-06"],
    ["post", `/barber/bookings/${SOME_ID}/complete`],
    ["post", `/barber/bookings/${SOME_ID}/no-show`],
    ["get", "/barber/days-off"],
    ["post", "/barber/days-off"],
    ["delete", `/barber/days-off/${SOME_ID}`],
  ] as const;

  it.each(endpoints)("refuses a customer on %s %s", async (method, path) => {
    const response = await request(app)[method](path).set("Authorization", davitAuth);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it.each(endpoints)("refuses a visitor who is not logged in on %s %s", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
  });
});

describe("GET /barber/schedule", () => {
  it("returns each day with its hours and the barber's own bookings", async () => {
    const booking = await insertBooking(giorgi, at(NEXT_WEEK, "10:00"));
    await insertBooking(giorgi, at(addDays(NEXT_WEEK, 1), "15:00"));
    await insertBooking(luka, at(NEXT_WEEK, "10:00"));

    const response = await getSchedule(giorgiAuth, NEXT_WEEK, addDays(NEXT_WEEK, 1));

    expect(response.status).toBe(200);
    const [first, second] = response.body.days;
    expect(response.body.days).toHaveLength(2);
    expect(first.date).toBe(NEXT_WEEK);
    expect(first.workingHours).toEqual({
      startMinute: 540,
      endMinute: 1080,
      breakStartMinute: 780,
      breakEndMinute: 840,
    });
    expect(first.dayOff).toBeNull();
    expect(first.bookings).toEqual([
      {
        id: booking.id,
        status: "confirmed",
        startsAt: at(NEXT_WEEK, "10:00").toISOString(),
        endsAt: at(NEXT_WEEK, "10:30").toISOString(),
        localDate: NEXT_WEEK,
        localTime: "10:00",
        localEndTime: "10:30",
        priceCents: 2500,
        service: { id: haircut.id, name: "Haircut" },
        customer: { name: "Davit Maisuradze", phone: "+995 555 01 01 01" },
      },
    ]);
    expect(second.bookings.map((entry: { localTime: string }) => entry.localTime)).toEqual([
      "15:00",
    ]);
  });

  it("puts a booking on the shop's calendar day, not the UTC one", async () => {
    await insertBooking(giorgi, at(NEXT_WEEK, "00:30"));

    const response = await getSchedule(giorgiAuth, addDays(NEXT_WEEK, -1), addDays(NEXT_WEEK, 1));

    const counts = response.body.days.map((day: { bookings: unknown[] }) => day.bookings.length);
    expect(counts).toEqual([0, 1, 0]);
  });

  it("leaves out cancelled bookings and shows a day off", async () => {
    await insertBooking(giorgi, at(NEXT_WEEK, "10:00"), "CANCELLED");
    await prisma.dayOff.create({
      data: { barberId: giorgi.id, date: toDateColumn(NEXT_WEEK), reason: "Dentist" },
    });

    const response = await getSchedule(giorgiAuth, NEXT_WEEK, NEXT_WEEK);

    expect(response.body.days[0].bookings).toEqual([]);
    expect(response.body.days[0].dayOff).toMatchObject({ date: NEXT_WEEK, reason: "Dentist" });
  });

  it("rejects a range that is backwards or too long", async () => {
    const backwards = await getSchedule(giorgiAuth, NEXT_WEEK, TODAY);
    const tooLong = await getSchedule(giorgiAuth, TODAY, addDays(TODAY, 31));
    const longestAllowed = await getSchedule(giorgiAuth, TODAY, addDays(TODAY, 30));

    expect(backwards.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.details[0].path).toBe("to");
    expect(longestAllowed.status).toBe(200);
    expect(longestAllowed.body.days).toHaveLength(31);
  });
});

describe("recording how an appointment went", () => {
  function mark(auth: string, bookingId: string, outcome: "complete" | "no-show") {
    return request(app).post(`/barber/bookings/${bookingId}/${outcome}`).set("Authorization", auth);
  }

  const statusOf = async (bookingId: string) =>
    (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;

  it("marks a started booking completed", async () => {
    const booking = await insertBooking(giorgi, anHourAgo());

    const response = await mark(giorgiAuth, booking.id, "complete");

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({ id: booking.id, status: "completed" });
    expect(await statusOf(booking.id)).toBe("COMPLETED");
  });

  it("marks a started booking as a no-show", async () => {
    const booking = await insertBooking(giorgi, anHourAgo());

    const response = await mark(giorgiAuth, booking.id, "no-show");

    expect(response.status).toBe(200);
    expect(await statusOf(booking.id)).toBe("NO_SHOW");
  });

  it("lets the barber correct an outcome", async () => {
    const booking = await insertBooking(giorgi, anHourAgo(), "NO_SHOW");

    const response = await mark(giorgiAuth, booking.id, "complete");

    expect(response.status).toBe(200);
    expect(await statusOf(booking.id)).toBe("COMPLETED");
  });

  it("refuses before the appointment has started", async () => {
    const booking = await insertBooking(giorgi, new Date(Date.now() + 5 * 60 * 1000));

    const response = await mark(giorgiAuth, booking.id, "complete");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_STARTED");
    expect(await statusOf(booking.id)).toBe("CONFIRMED");
  });

  it("refuses a cancelled booking", async () => {
    const booking = await insertBooking(giorgi, anHourAgo(), "CANCELLED");

    const response = await mark(giorgiAuth, booking.id, "complete");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_ACTIVE");
  });

  it("does not let a barber change another barber's booking", async () => {
    const booking = await insertBooking(giorgi, anHourAgo());

    const completed = await mark(lukaAuth, booking.id, "complete");
    const noShow = await mark(lukaAuth, booking.id, "no-show");

    expect(completed.status).toBe(404);
    expect(noShow.status).toBe(404);
    expect(await statusOf(booking.id)).toBe("CONFIRMED");
  });
});

describe("days off", () => {
  it("adds a day off, which then has no free times", async () => {
    const response = await addDayOff(giorgiAuth, NEXT_WEEK, "Family event");

    expect(response.status).toBe(201);
    expect(response.body.dayOff).toEqual({
      id: expect.any(String),
      date: NEXT_WEEK,
      reason: "Family event",
    });

    const availability = await request(app)
      .get("/availability")
      .query({ barberId: giorgi.id, serviceId: haircut.id, date: NEXT_WEEK });
    expect(availability.body.slots).toEqual([]);
  });

  it("lists the barber's own upcoming days off, soonest first", async () => {
    await addDayOff(giorgiAuth, addDays(TODAY, 20));
    await addDayOff(giorgiAuth, addDays(TODAY, 10));
    await addDayOff(lukaAuth, addDays(TODAY, 15));
    await prisma.dayOff.create({
      data: { barberId: giorgi.id, date: toDateColumn(addDays(TODAY, -3)) },
    });

    const response = await request(app).get("/barber/days-off").set("Authorization", giorgiAuth);

    expect(response.status).toBe(200);
    expect(response.body.daysOff.map((dayOff: { date: string }) => dayOff.date)).toEqual([
      addDays(TODAY, 10),
      addDays(TODAY, 20),
    ]);
  });

  it("refuses a date that has bookings and says which ones", async () => {
    const booking = await insertBooking(giorgi, at(NEXT_WEEK, "10:00"));
    await insertBooking(giorgi, at(NEXT_WEEK, "15:30"), "PENDING");
    await insertBooking(giorgi, at(NEXT_WEEK, "12:00"), "CANCELLED");
    await insertBooking(luka, at(NEXT_WEEK, "11:00"));

    const response = await addDayOff(giorgiAuth, NEXT_WEEK);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DAY_HAS_BOOKINGS");
    expect(response.body.error.message).toContain("You have 2 bookings on");
    expect(response.body.error.details.bookings).toEqual([
      {
        id: booking.id,
        localTime: "10:00",
        customerName: "Davit Maisuradze",
        serviceName: "Haircut",
      },
      expect.objectContaining({ localTime: "15:30" }),
    ]);
    expect(await prisma.dayOff.count()).toBe(0);
  });

  it("refuses a past date, a far-off date and a repeat", async () => {
    const past = await addDayOff(giorgiAuth, addDays(TODAY, -1));
    const farOff = await addDayOff(giorgiAuth, addDays(TODAY, 366));
    await addDayOff(giorgiAuth, NEXT_WEEK);
    const repeat = await addDayOff(giorgiAuth, NEXT_WEEK);

    expect(past.status).toBe(400);
    expect(past.body.error.details).toEqual([
      { path: "date", message: "Choose today or a later date" },
    ]);
    expect(farOff.status).toBe(400);
    expect(repeat.status).toBe(409);
    expect(repeat.body.error.code).toBe("DAY_OFF_EXISTS");
  });

  it("removes the barber's own day off", async () => {
    const { dayOff } = (await addDayOff(giorgiAuth, NEXT_WEEK)).body;

    const response = await request(app)
      .delete(`/barber/days-off/${dayOff.id}`)
      .set("Authorization", giorgiAuth);

    expect(response.status).toBe(204);
    expect(await prisma.dayOff.count()).toBe(0);
  });

  it("does not let a barber remove another barber's day off", async () => {
    const { dayOff } = (await addDayOff(giorgiAuth, NEXT_WEEK)).body;

    const response = await request(app)
      .delete(`/barber/days-off/${dayOff.id}`)
      .set("Authorization", lukaAuth);

    expect(response.status).toBe(404);
    expect(await prisma.dayOff.count()).toBe(1);
  });

  it("keeps each barber's days off separate", async () => {
    await addDayOff(giorgiAuth, NEXT_WEEK);

    await insertBooking(giorgi, at(addDays(NEXT_WEEK, 1), "10:00"));
    const sameDate = await addDayOff(lukaAuth, NEXT_WEEK);
    const giorgiIsBooked = await addDayOff(lukaAuth, addDays(NEXT_WEEK, 1));

    expect(sameDate.status).toBe(201);
    expect(giorgiIsBooked.status).toBe(201);
  });
});
