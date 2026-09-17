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
  createBarber,
  createService,
  createUser,
  markAsPaid,
  resetDatabase,
} from "./helpers.ts";

const HOUR_MS = 60 * 60 * 1000;

// A week from today: outside the 24-hour cancellation window and well
// inside the 60-day limit. The test barber works every day of the week.
const DATE = addDays(shopDateOf(new Date(), env.shopTimeZone), 7);

function at(clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return shopTimeToUtc(DATE, (hours ?? 0) * 60 + (minutes ?? 0), env.shopTimeZone);
}

let app: Express;
let barber: Barber;
let haircut: Service;
let alex: User;
let priya: User;
let alexAuth: string;
let priyaAuth: string;

beforeEach(async () => {
  await resetDatabase();
  app = createApp();
  barber = await createBarber("Marco Rossi");
  haircut = await createService("Haircut");
  alex = await createUser("alex@example.test");
  priya = await createUser("priya@example.test");
  alexAuth = await authHeaderFor(alex);
  priyaAuth = await authHeaderFor(priya);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function book(auth: string, clockTime: string) {
  return request(app)
    .post("/bookings")
    .set("Authorization", auth)
    .send({ barberId: barber.id, serviceId: haircut.id, startsAt: at(clockTime).toISOString() });
}

// Books a slot and pays its deposit, which is what makes it "confirmed".
async function bookAndPay(auth: string, clockTime: string) {
  const { booking } = (await book(auth, clockTime)).body;
  await markAsPaid(booking.id);
  return booking as { id: string };
}

function cancel(auth: string, bookingId: string) {
  return request(app).post(`/bookings/${bookingId}/cancel`).set("Authorization", auth);
}

function reschedule(auth: string, bookingId: string, clockTime: string) {
  return request(app)
    .post(`/bookings/${bookingId}/reschedule`)
    .set("Authorization", auth)
    .send({ startsAt: at(clockTime).toISOString() });
}

async function freeTimes(): Promise<string[]> {
  const response = await request(app)
    .get("/availability")
    .query({ barberId: barber.id, serviceId: haircut.id, date: DATE });
  return response.body.slots.map((slot: { localTime: string }) => slot.localTime);
}

// Writes a booking straight to the database, for times the API would
// refuse to book (in the past, or minutes from now).
function insertBooking(customer: User, startsAt: Date, status: BookingStatus = "CONFIRMED") {
  return prisma.booking.create({
    data: {
      customerId: customer.id,
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

describe("GET /services and GET /barbers", () => {
  it("lists only active services", async () => {
    await createService("Retired service", false);

    const response = await request(app).get("/services");

    expect(response.status).toBe(200);
    expect(response.body.services).toEqual([
      {
        id: haircut.id,
        name: "Haircut",
        description: null,
        durationMinutes: 30,
        priceCents: 2500,
        depositCents: 1000,
      },
    ]);
  });

  it("lists only active barbers, without private details", async () => {
    await createBarber("Former Barber", false);

    const response = await request(app).get("/barbers");

    expect(response.status).toBe(200);
    expect(response.body.barbers).toHaveLength(1);
    expect(response.body.barbers[0]).toMatchObject({
      id: barber.id,
      name: "Marco Rossi",
      bio: null,
    });
    expect(Object.keys(response.body.barbers[0]).sort()).toEqual([
      "bio",
      "id",
      "name",
      "workingHours",
    ]);
  });

  it("includes each barber's working hours, ordered by weekday", async () => {
    const response = await request(app).get("/barbers");

    const { workingHours } = response.body.barbers[0];
    expect(workingHours).toHaveLength(7);
    expect(workingHours[0]).toEqual({ weekday: 0, startMinute: 540, endMinute: 1080 });
  });
});

describe("GET /shop", () => {
  it("returns the time zone, today's shop date and the booking limits", async () => {
    const response = await request(app).get("/shop");

    const today = shopDateOf(new Date(), env.shopTimeZone);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      timeZone: env.shopTimeZone,
      today,
      lastBookableDate: addDays(today, 60),
      freeCancellationHours: 24,
    });
  });
});

describe("GET /availability", () => {
  it("returns each free slot as a UTC instant and a shop clock time", async () => {
    const response = await request(app)
      .get("/availability")
      .query({ barberId: barber.id, serviceId: haircut.id, date: DATE });

    expect(response.status).toBe(200);
    expect(response.body.date).toBe(DATE);
    expect(response.body.timeZone).toBe(env.shopTimeZone);
    expect(response.body.slots[0]).toEqual({
      startsAt: at("09:00").toISOString(),
      localTime: "09:00",
    });
  });

  it("leaves out booked times and the break, and keeps cancelled ones", async () => {
    await insertBooking(alex, at("10:00"));
    await insertBooking(priya, at("11:00"), "CANCELLED");

    const times = await freeTimes();

    expect(times).not.toContain("10:00");
    expect(times).toContain("10:30");
    expect(times).toContain("11:00");
    expect(times).not.toContain("13:00");
  });

  it("has no slots on the barber's day off", async () => {
    await prisma.dayOff.create({
      data: { barberId: barber.id, date: toDateColumn(DATE) },
    });

    expect(await freeTimes()).toEqual([]);
  });

  it("rejects a missing barber or an impossible date", async () => {
    const response = await request(app)
      .get("/availability")
      .query({ serviceId: haircut.id, date: "2026-02-30" });

    expect(response.status).toBe(400);
    const invalidPaths = response.body.error.details.map(
      (detail: { path: string }) => detail.path,
    );
    expect(invalidPaths.sort()).toEqual(["barberId", "date"]);
  });

  it("answers 404 for a barber who is not active", async () => {
    const former = await createBarber("Former Barber", false);

    const response = await request(app)
      .get("/availability")
      .query({ barberId: former.id, serviceId: haircut.id, date: DATE });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BARBER_NOT_FOUND");
  });
});

describe("GET /availability with excludeBookingId", () => {
  // Alex has 10:00-10:30. Without the exclusion, 09:45 to 10:15 are blocked.
  const BLOCKED_BY_ALEX = ["09:45", "10:00", "10:15"];

  async function freeTimesExcluding(bookingId: string, auth?: string): Promise<string[]> {
    const pending = request(app)
      .get("/availability")
      .query({ barberId: barber.id, serviceId: haircut.id, date: DATE, excludeBookingId: bookingId });
    const response = await (auth ? pending.set("Authorization", auth) : pending);
    expect(response.status).toBe(200);
    return response.body.slots.map((slot: { localTime: string }) => slot.localTime);
  }

  it("leaves out the caller's own booking, so times overlapping it are offered", async () => {
    const own = await insertBooking(alex, at("10:00"));

    const times = await freeTimesExcluding(own.id, alexAuth);

    expect(times).toEqual(expect.arrayContaining(BLOCKED_BY_ALEX));
  });

  it("still blocks other customers' bookings while leaving out the caller's own", async () => {
    const own = await insertBooking(alex, at("10:00"));
    await insertBooking(priya, at("11:00"));

    const times = await freeTimesExcluding(own.id, alexAuth);

    expect(times).toContain("10:00");
    expect(times).not.toContain("11:00");
  });

  it("ignores the id of someone else's booking", async () => {
    const alexBooking = await insertBooking(alex, at("10:00"));

    const times = await freeTimesExcluding(alexBooking.id, priyaAuth);

    for (const time of BLOCKED_BY_ALEX) {
      expect(times).not.toContain(time);
    }
  });

  it("ignores the id when the caller is not logged in", async () => {
    const alexBooking = await insertBooking(alex, at("10:00"));

    const times = await freeTimesExcluding(alexBooking.id);

    expect(times).not.toContain("10:00");
  });

  it("ignores an id that matches no booking", async () => {
    await insertBooking(alex, at("10:00"));

    const times = await freeTimesExcluding("7b1d7d0e-3c0a-4f6e-9d55-2f0c1a9e4b11", alexAuth);

    expect(times).not.toContain("10:00");
  });

  it("refuses an invalid token instead of treating the caller as anonymous", async () => {
    const response = await request(app)
      .get("/availability")
      .query({ barberId: barber.id, serviceId: haircut.id, date: DATE })
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an id that is not a UUID", async () => {
    const response = await request(app)
      .get("/availability")
      .query({ barberId: barber.id, serviceId: haircut.id, date: DATE, excludeBookingId: "abc" });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toBe("excludeBookingId");
  });
});

describe("POST /bookings", () => {
  it("books a free slot and copies the price and deposit from the service", async () => {
    const response = await book(alexAuth, "10:00");

    expect(response.status).toBe(201);
    expect(response.body.booking).toMatchObject({
      status: "pending",
      startsAt: at("10:00").toISOString(),
      endsAt: at("10:30").toISOString(),
      localDate: DATE,
      localTime: "10:00",
      priceCents: 2500,
      depositCents: 1000,
      service: { id: haircut.id, name: "Haircut" },
      barber: { id: barber.id, name: "Marco Rossi" },
    });

    const saved = await prisma.booking.findUniqueOrThrow({
      where: { id: response.body.booking.id },
    });
    expect(saved.customerId).toBe(alex.id);
  });

  it("requires a logged-in user", async () => {
    const response = await request(app)
      .post("/bookings")
      .send({ barberId: barber.id, serviceId: haircut.id, startsAt: at("10:00").toISOString() });

    expect(response.status).toBe(401);
  });

  it("rejects a malformed request", async () => {
    const response = await request(app)
      .post("/bookings")
      .set("Authorization", alexAuth)
      .send({ barberId: "not-an-id", serviceId: haircut.id, startsAt: "tomorrow" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["off the 15-minute grid", "10:07"],
    ["before opening", "08:00"],
    ["running past closing", "17:45"],
    ["during the break", "13:15"],
  ])("refuses a time that is %s", async (_reason, clockTime) => {
    const response = await book(alexAuth, clockTime);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("refuses a time that overlaps an existing booking", async () => {
    await book(alexAuth, "10:00");

    const sameSlot = await book(priyaAuth, "10:00");
    const overlapping = await book(priyaAuth, "09:45");
    const backToBack = await book(priyaAuth, "10:30");

    expect(sameSlot.status).toBe(409);
    expect(overlapping.status).toBe(409);
    expect(backToBack.status).toBe(201);
  });

  it("lets exactly one of two simultaneous requests for a slot succeed", async () => {
    const responses = await Promise.all([book(alexAuth, "10:00"), book(priyaAuth, "10:00")]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const refused = responses.find((response) => response.status === 409);
    expect(refused?.body.error.code).toBe("SLOT_UNAVAILABLE");
    expect(await prisma.booking.count({ where: { barberId: barber.id } })).toBe(1);
  });
});

describe("GET /bookings/mine", () => {
  it("splits the customer's own bookings into upcoming and past", async () => {
    const upcoming = (await book(alexAuth, "10:00")).body.booking;
    const past = await insertBooking(alex, new Date(Date.now() - 48 * HOUR_MS), "COMPLETED");
    await book(priyaAuth, "11:00");

    const response = await request(app).get("/bookings/mine").set("Authorization", alexAuth);

    expect(response.status).toBe(200);
    expect(response.body.upcoming.map((booking: { id: string }) => booking.id)).toEqual([
      upcoming.id,
    ]);
    expect(response.body.past).toHaveLength(1);
    expect(response.body.past[0]).toMatchObject({ id: past.id, status: "completed" });
  });
});

describe("POST /bookings/:id/cancel", () => {
  it("cancels inside the free window and frees the slot", async () => {
    const { booking } = (await book(alexAuth, "10:00")).body;

    const response = await cancel(alexAuth, booking.id);

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({
      id: booking.id,
      status: "cancelled",
      cancelledInFreeWindow: true,
      cancelledAt: expect.any(String),
    });
    expect(await freeTimes()).toContain("10:00");
  });

  it("records a cancellation less than 24 hours before as outside the free window", async () => {
    const soon = await insertBooking(alex, new Date(Date.now() + 3 * HOUR_MS));

    const response = await cancel(alexAuth, soon.id);

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({
      status: "cancelled",
      cancelledInFreeWindow: false,
    });
  });

  it("refuses once the booking has started", async () => {
    const started = await insertBooking(alex, new Date(Date.now() - 5 * 60 * 1000));

    const response = await cancel(alexAuth, started.id);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_ALREADY_STARTED");
  });

  it("refuses a booking that is already cancelled", async () => {
    const { booking } = (await book(alexAuth, "10:00")).body;
    await cancel(alexAuth, booking.id);

    const response = await cancel(alexAuth, booking.id);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_ACTIVE");
  });

  it("does not let a customer cancel someone else's booking", async () => {
    const { booking } = (await book(alexAuth, "10:00")).body;

    const response = await cancel(priyaAuth, booking.id);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BOOKING_NOT_FOUND");
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved.status).toBe("PENDING");
  });
});

describe("POST /bookings/:id/reschedule", () => {
  it("moves the booking, freeing the old slot and taking the new one", async () => {
    const booking = await bookAndPay(alexAuth, "10:00");

    const response = await reschedule(alexAuth, booking.id, "15:00");

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({
      id: booking.id,
      status: "confirmed",
      localTime: "15:00",
      endsAt: at("15:30").toISOString(),
    });
    const times = await freeTimes();
    expect(times).toContain("10:00");
    expect(times).not.toContain("15:00");
  });

  it("allows a new time that overlaps the booking's own current time", async () => {
    const booking = await bookAndPay(alexAuth, "10:00");

    const response = await reschedule(alexAuth, booking.id, "10:15");

    expect(response.status).toBe(200);
    expect(response.body.booking.localTime).toBe("10:15");
  });

  it("keeps the old slot when the new one is taken", async () => {
    const booking = await bookAndPay(alexAuth, "10:00");
    await book(priyaAuth, "15:00");

    const response = await reschedule(alexAuth, booking.id, "15:00");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SLOT_UNAVAILABLE");
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved.startsAt).toEqual(at("10:00"));
    expect(saved.status).toBe("CONFIRMED");
  });

  it("applies the same rules as a new booking", async () => {
    const booking = await bookAndPay(alexAuth, "10:00");

    expect((await reschedule(alexAuth, booking.id, "13:15")).status).toBe(409);
    expect((await reschedule(alexAuth, booking.id, "10:07")).status).toBe(409);
  });

  it("refuses a cancelled booking", async () => {
    const booking = await bookAndPay(alexAuth, "10:00");
    await cancel(alexAuth, booking.id);

    const response = await reschedule(alexAuth, booking.id, "15:00");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_ACTIVE");
  });

  it("does not let a customer reschedule someone else's booking", async () => {
    const booking = await bookAndPay(alexAuth, "10:00");

    const response = await reschedule(priyaAuth, booking.id, "15:00");

    expect(response.status).toBe(404);
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved.startsAt).toEqual(at("10:00"));
  });
});
