import type { Express } from "express";
import { readSheet } from "read-excel-file/node";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type { Barber, BookingStatus, Service, User } from "../src/generated/prisma/client.ts";
import { addDays, shopDateOf, shopTimeToUtc } from "../src/shop/time.ts";
import {
  authHeaderFor,
  authHeaderForBarber,
  createBarber,
  createUser,
  resetDatabase,
  TEST_PASSWORD,
} from "./helpers.ts";

const TODAY = shopDateOf(new Date(), env.shopTimeZone);
const NEXT_WEEK = addDays(TODAY, 7);

function at(shopDate: string, clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return shopTimeToUtc(shopDate, (hours ?? 0) * 60 + (minutes ?? 0), env.shopTimeZone);
}

let app: Express;
let adminAuth: string;
let giorgi: Barber;
let luka: Barber;
let haircut: Service;
let beardTrim: Service;
let kidsHaircut: Service;
let davit: User;
let nino: User;

beforeEach(async () => {
  await resetDatabase();
  app = createApp();
  adminAuth = await authHeaderFor(await createUser("tamar@dalaki.example", "ADMIN"));
  giorgi = await createBarber("Giorgi Kapanadze");
  luka = await createBarber("Luka Gelashvili");
  haircut = await prisma.service.create({
    data: { name: "Haircut", durationMinutes: 45, priceCents: 4500, depositCents: 1500 },
  });
  beardTrim = await prisma.service.create({
    data: { name: "Beard trim", durationMinutes: 30, priceCents: 2500, depositCents: 1000 },
  });
  kidsHaircut = await prisma.service.create({
    data: { name: "Kids haircut", durationMinutes: 30, priceCents: 3000, depositCents: 1000 },
  });
  davit = await prisma.user.update({
    where: { id: (await createUser("davit@dalaki.example")).id },
    data: { name: "Davit Maisuradze", phone: "+995 555 01 01 01" },
  });
  nino = await prisma.user.update({
    where: { id: (await createUser("nino@dalaki.example")).id },
    data: { name: "Nino Lomidze" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

type NewBooking = {
  barber?: Barber;
  service?: Service;
  customer?: User;
  status?: BookingStatus;
};

function insertBooking(startsAt: Date, options: NewBooking = {}) {
  const service = options.service ?? haircut;
  return prisma.booking.create({
    data: {
      customerId: (options.customer ?? davit).id,
      barberId: (options.barber ?? giorgi).id,
      serviceId: service.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
      status: options.status ?? "CONFIRMED",
      priceCents: service.priceCents,
      depositCents: service.depositCents,
    },
  });
}

const asAdmin = {
  get: (path: string) => request(app).get(path).set("Authorization", adminAuth),
  post: (path: string, body?: object) =>
    request(app).post(path).set("Authorization", adminAuth).send(body),
  patch: (path: string, body: object) =>
    request(app).patch(path).set("Authorization", adminAuth).send(body),
  put: (path: string, body: object) =>
    request(app).put(path).set("Authorization", adminAuth).send(body),
};

describe("who may use the admin endpoints", () => {
  const SOME_ID = "7b1d7d0e-3c0a-4f6e-9d55-2f0c1a9e4b11";
  const endpoints = [
    ["get", "/admin/services"],
    ["post", "/admin/services"],
    ["patch", `/admin/services/${SOME_ID}`],
    ["get", "/admin/barbers"],
    ["post", "/admin/barbers"],
    ["patch", `/admin/barbers/${SOME_ID}`],
    ["put", `/admin/barbers/${SOME_ID}/working-hours`],
    ["get", "/admin/bookings"],
    ["get", "/admin/bookings/export.xlsx"],
    ["post", `/admin/bookings/${SOME_ID}/cancel`],
    ["get", "/admin/overview?from=2026-03-10&to=2026-03-13"],
  ] as const;

  it.each(endpoints)("refuses a customer on %s %s", async (method, path) => {
    const response = await request(app)
      [method](path)
      .set("Authorization", await authHeaderFor(davit));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it.each(endpoints)("refuses a barber on %s %s", async (method, path) => {
    const response = await request(app)
      [method](path)
      .set("Authorization", await authHeaderForBarber(giorgi));

    expect(response.status).toBe(403);
  });

  it.each(endpoints)("refuses a visitor who is not logged in on %s %s", async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });
});

describe("services", () => {
  const headShave = { name: "Head shave", durationMinutes: 30, priceCents: 2000, depositCents: 500 };

  it("creates a service that customers can then book", async () => {
    const response = await asAdmin.post("/admin/services", {
      ...headShave,
      description: "  Clippers, then a razor.  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.service).toEqual({
      id: expect.any(String),
      ...headShave,
      description: "Clippers, then a razor.",
      isActive: true,
    });
    const publicNames = (await request(app).get("/services")).body.services.map(
      (service: { name: string }) => service.name,
    );
    expect(publicNames).toContain("Head shave");
  });

  it("rejects a duplicate name, an off-grid duration and a deposit above the price", async () => {
    const duplicate = await asAdmin.post("/admin/services", { ...headShave, name: "Haircut" });
    const offGrid = await asAdmin.post("/admin/services", { ...headShave, durationMinutes: 20 });
    const greedy = await asAdmin.post("/admin/services", { ...headShave, depositCents: 2500 });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("SERVICE_NAME_TAKEN");
    expect(offGrid.status).toBe(400);
    expect(offGrid.body.error.details[0].path).toBe("durationMinutes");
    expect(greedy.status).toBe(400);
    expect(greedy.body.error.details[0].path).toBe("depositCents");
  });

  it("edits a service without touching bookings already made", async () => {
    const booking = await insertBooking(at(NEXT_WEEK, "10:00"));

    const response = await asAdmin.patch(`/admin/services/${haircut.id}`, {
      priceCents: 5000,
      durationMinutes: 60,
    });

    expect(response.status).toBe(200);
    expect(response.body.service).toMatchObject({ priceCents: 5000, durationMinutes: 60 });
    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(kept.priceCents).toBe(4500);
    expect(kept.endsAt).toEqual(at(NEXT_WEEK, "10:45"));
  });

  it("checks the deposit against the price already stored", async () => {
    // The haircut costs 45.00; a 50.00 deposit alone must be refused.
    const response = await asAdmin.patch(`/admin/services/${haircut.id}`, { depositCents: 5000 });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toBe("depositCents");
  });

  it("deactivates instead of deleting: off the website, still in the admin list", async () => {
    const response = await asAdmin.patch(`/admin/services/${haircut.id}`, { isActive: false });

    expect(response.status).toBe(200);
    const publicNames = (await request(app).get("/services")).body.services.map(
      (service: { name: string }) => service.name,
    );
    expect(publicNames).not.toContain("Haircut");
    const adminList = (await asAdmin.get("/admin/services")).body.services;
    expect(adminList).toHaveLength(3);
    expect(
      adminList.find((service: { name: string }) => service.name === "Haircut").isActive,
    ).toBe(false);
  });

  it("answers 404 for a service that doesn't exist", async () => {
    const response = await asAdmin.patch(
      "/admin/services/7b1d7d0e-3c0a-4f6e-9d55-2f0c1a9e4b11",
      { priceCents: 100 },
    );

    expect(response.status).toBe(404);
  });
});

describe("staff", () => {
  const sandro = {
    name: "Sandro Jgenti",
    email: "Sandro@Dalaki.example",
    password: TEST_PASSWORD,
    bio: "New on the team.",
  };

  it("creates a barber account that can log in and see a schedule", async () => {
    const response = await asAdmin.post("/admin/barbers", sandro);

    expect(response.status).toBe(201);
    expect(response.body.barber).toEqual({
      id: expect.any(String),
      name: "Sandro Jgenti",
      email: "sandro@dalaki.example",
      bio: "New on the team.",
      isActive: true,
      workingHours: [],
    });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "sandro@dalaki.example", password: TEST_PASSWORD });
    expect(login.body.user.role).toBe("barber");
    const schedule = await request(app)
      .get(`/barber/schedule?from=${TODAY}&to=${TODAY}`)
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(schedule.status).toBe(200);
  });

  it("refuses an email that already has an account", async () => {
    const response = await asAdmin.post("/admin/barbers", {
      ...sandro,
      email: "davit@dalaki.example",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("edits the name and bio, and deactivates", async () => {
    const response = await asAdmin.patch(`/admin/barbers/${giorgi.id}`, {
      name: "Giorgi K.",
      bio: null,
      isActive: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.barber).toMatchObject({ name: "Giorgi K.", bio: null, isActive: false });
    const publicNames = (await request(app).get("/barbers")).body.barbers.map(
      (barber: { name: string }) => barber.name,
    );
    expect(publicNames).toEqual(["Luka Gelashvili"]);
  });

  it("replaces the working hours, which changes the times on offer", async () => {
    const weekday = new Date(`${NEXT_WEEK}T00:00:00Z`).getUTCDay();

    const response = await asAdmin.put(`/admin/barbers/${giorgi.id}/working-hours`, {
      days: [
        {
          weekday,
          startMinute: 12 * 60,
          endMinute: 16 * 60,
          breakStartMinute: 13 * 60,
          breakEndMinute: 14 * 60,
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.barber.workingHours).toEqual([
      {
        weekday,
        startMinute: 720,
        endMinute: 960,
        breakStartMinute: 780,
        breakEndMinute: 840,
      },
    ]);

    const slotsOn = async (date: string) =>
      (
        await request(app)
          .get("/availability")
          .query({ barberId: giorgi.id, serviceId: beardTrim.id, date })
      ).body.slots.map((slot: { localTime: string }) => slot.localTime);
    expect(await slotsOn(NEXT_WEEK)).toEqual([
      "12:00",
      "12:15",
      "12:30",
      "14:00",
      "14:15",
      "14:30",
      "14:45",
      "15:00",
      "15:15",
      "15:30",
    ]);
    // Every other weekday was removed.
    expect(await slotsOn(addDays(NEXT_WEEK, 1))).toEqual([]);
  });

  it.each([
    ["an end before the start", { startMinute: 600, endMinute: 540 }],
    ["a break with only one end", { breakStartMinute: 780 }],
    ["a break outside the working hours", { breakStartMinute: 480, breakEndMinute: 600 }],
  ])("rejects %s and keeps the old hours", async (_case, override) => {
    const day = {
      weekday: 1,
      startMinute: 540,
      endMinute: 1080,
      breakStartMinute: null,
      breakEndMinute: null,
      ...override,
    };

    const response = await asAdmin.put(`/admin/barbers/${giorgi.id}/working-hours`, {
      days: [day],
    });

    expect(response.status).toBe(400);
    expect(await prisma.workingHours.count({ where: { barberId: giorgi.id } })).toBe(7);
  });

  it("rejects the same weekday twice", async () => {
    const day = {
      weekday: 1,
      startMinute: 540,
      endMinute: 1080,
      breakStartMinute: null,
      breakEndMinute: null,
    };

    const response = await asAdmin.put(`/admin/barbers/${giorgi.id}/working-hours`, {
      days: [day, day],
    });

    expect(response.status).toBe(400);
  });
});

describe("the bookings table", () => {
  // Five bookings over three days, with enough variety to tell every
  // filter and sort order apart.
  beforeEach(async () => {
    const day1 = NEXT_WEEK;
    const day2 = addDays(NEXT_WEEK, 1);
    const day3 = addDays(NEXT_WEEK, 2);
    await insertBooking(at(day1, "10:00"), { customer: davit, barber: giorgi, service: haircut });
    await insertBooking(at(day1, "11:00"), {
      customer: nino,
      barber: luka,
      service: beardTrim,
      status: "PENDING",
    });
    await insertBooking(at(day2, "00:15"), { customer: nino, barber: giorgi, service: kidsHaircut });
    await insertBooking(at(day2, "23:30"), {
      customer: davit,
      barber: luka,
      service: beardTrim,
      status: "CANCELLED",
    });
    await insertBooking(at(day3, "09:00"), { customer: davit, barber: giorgi, service: haircut });
  });

  type Row = {
    localDate: string;
    localTime: string;
    status: string;
    priceCents: number;
    customer: { name: string };
    barber: { name: string };
  };
  const times = (rows: Row[]) => rows.map((row) => `${row.localDate.slice(-2)} ${row.localTime}`);
  const day = (offset: number) => addDays(NEXT_WEEK, offset).slice(-2);

  async function list(query: Record<string, string | number> = {}) {
    const response = await asAdmin.get("/admin/bookings").query(query);
    expect(response.status).toBe(200);
    return response.body as { bookings: Row[]; total: number; page: number; pageSize: number };
  }

  it("lists everything, newest first, with who and what", async () => {
    const result = await list();

    expect(result.total).toBe(5);
    expect(times(result.bookings)).toEqual([
      `${day(2)} 09:00`,
      `${day(1)} 23:30`,
      `${day(1)} 00:15`,
      `${day(0)} 11:00`,
      `${day(0)} 10:00`,
    ]);
    expect(result.bookings[4]).toMatchObject({
      status: "confirmed",
      priceCents: 4500,
      customer: { name: "Davit Maisuradze", email: "davit@dalaki.example" },
      barber: { name: "Giorgi Kapanadze" },
      service: { name: "Haircut" },
    });
  });

  it("filters by a date range in shop time, both ends included", async () => {
    const middleDay = addDays(NEXT_WEEK, 1);

    const result = await list({ from: middleDay, to: middleDay, order: "asc" });

    // 00:15 and 23:30 are both on the shop's middle day, though one of
    // them falls on a different date in UTC.
    expect(times(result.bookings)).toEqual([`${day(1)} 00:15`, `${day(1)} 23:30`]);
  });

  it("filters by barber, by status, and by both", async () => {
    expect((await list({ barberId: luka.id })).total).toBe(2);
    expect((await list({ status: "confirmed" })).total).toBe(3);
    expect((await list({ status: "cancelled" })).bookings[0]?.barber.name).toBe("Luka Gelashvili");
    expect((await list({ barberId: luka.id, status: "pending" })).total).toBe(1);
    expect((await list({ barberId: giorgi.id, status: "pending" })).total).toBe(0);
  });

  it("searches customers by name, email or phone, ignoring case", async () => {
    expect((await list({ search: "LOMIDZE" })).total).toBe(2);
    expect((await list({ search: "davit@" })).total).toBe(3);
    expect((await list({ search: "555 01 01" })).total).toBe(3);
    expect((await list({ search: "nobody" })).total).toBe(0);
  });

  it("sorts on the server", async () => {
    const byCustomer = await list({ sort: "customer", order: "asc" });
    const byPrice = await list({ sort: "price", order: "desc" });
    const byBarber = await list({ sort: "barber", order: "desc" });

    expect(byCustomer.bookings.map((row) => row.customer.name)).toEqual([
      "Davit Maisuradze",
      "Davit Maisuradze",
      "Davit Maisuradze",
      "Nino Lomidze",
      "Nino Lomidze",
    ]);
    expect(byPrice.bookings.map((row) => row.priceCents)).toEqual([4500, 4500, 3000, 2500, 2500]);
    expect(byBarber.bookings.map((row) => row.barber.name).slice(0, 2)).toEqual([
      "Luka Gelashvili",
      "Luka Gelashvili",
    ]);
  });

  it("pages on the server without repeating or dropping a row", async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => list({ page, pageSize: 2 })));

    expect(pages.map((page) => page.bookings.length)).toEqual([2, 2, 1]);
    expect(pages.every((page) => page.total === 5 && page.pageSize === 2)).toBe(true);
    const seen = pages.flatMap((page) => times(page.bookings));
    expect(new Set(seen).size).toBe(5);
    // Sorting applies across pages, not within each one.
    expect(seen).toEqual(times((await list()).bookings));
  });

  it("rejects an unknown sort column, status or page size", async () => {
    for (const query of [{ sort: "secret" }, { status: "done" }, { pageSize: 500 }, { page: 0 }]) {
      const response = await asAdmin.get("/admin/bookings").query(query);
      expect(response.status).toBe(400);
    }
  });
});

describe("POST /admin/bookings/:id/cancel", () => {
  it("cancels any customer's booking and frees the slot", async () => {
    const booking = await insertBooking(at(NEXT_WEEK, "10:00"), { customer: nino });

    const response = await asAdmin.post(`/admin/bookings/${booking.id}/cancel`);

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({ id: booking.id, status: "cancelled" });
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(saved.cancelledAt).toBeInstanceOf(Date);
    // Cancelled by the shop, so the customer keeps the right to a refund.
    expect(saved.cancelledInFreeWindow).toBe(true);
  });

  it("works on a booking that starts within the hour", async () => {
    const booking = await insertBooking(new Date(Date.now() + 10 * 60_000));

    expect((await asAdmin.post(`/admin/bookings/${booking.id}/cancel`)).status).toBe(200);
  });

  it("refuses a booking that already has an outcome", async () => {
    const booking = await insertBooking(at(addDays(TODAY, -1), "10:00"), { status: "COMPLETED" });

    const response = await asAdmin.post(`/admin/bookings/${booking.id}/cancel`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_ACTIVE");
  });

  it("answers 404 for a booking that doesn't exist", async () => {
    const response = await asAdmin.post(
      "/admin/bookings/7b1d7d0e-3c0a-4f6e-9d55-2f0c1a9e4b11/cancel",
    );

    expect(response.status).toBe(404);
  });
});

describe("GET /admin/bookings/export.xlsx", () => {
  it("returns a spreadsheet with real dates and numbers, honouring the filters", async () => {
    await insertBooking(at(NEXT_WEEK, "15:30"), { customer: davit, service: beardTrim });
    await insertBooking(at(NEXT_WEEK, "10:00"), { customer: nino, status: "CANCELLED" });

    const response = await asAdmin
      .get("/admin/bookings/export.xlsx")
      .query({ status: "confirmed" })
      .responseType("blob");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(response.headers["content-disposition"]).toMatch(
      /^attachment; filename="dalaki-bookings-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );

    const rows = await readSheet(response.body as Buffer);
    expect(rows[0]).toEqual([
      "Start",
      "Minutes",
      "Customer",
      "Email",
      "Phone",
      "Barber",
      "Service",
      "Status",
      "Price (GEL)",
      "Deposit (GEL)",
    ]);
    // Only the confirmed booking: the cancelled one was filtered out.
    expect(rows).toHaveLength(2);
    const [start, minutes, customer, , phone, barber, service, status, price, deposit] =
      rows[1] ?? [];
    // A date cell, holding the shop's clock time. A spreadsheet stores a
    // time as a fraction of a day, so it reads back within a millisecond.
    if (!(start instanceof Date)) {
      throw new Error(`The Start cell is not a date: ${String(start)}`);
    }
    expect(Math.abs(start.getTime() - Date.parse(`${NEXT_WEEK}T15:30:00Z`))).toBeLessThan(1000);
    // Number cells, in lari.
    expect(minutes).toBe(30);
    expect(price).toBe(25);
    expect(deposit).toBe(10);
    expect([customer, phone, barber, service, status]).toEqual([
      "Davit Maisuradze",
      "+995 555 01 01 01",
      "Giorgi Kapanadze",
      "Beard trim",
      "Confirmed",
    ]);
  });
});

describe("GET /admin/overview", () => {
  // A known data set over four shop days. What each query must return can
  // be worked out by hand from this table:
  //
  //   10 Mar  10:00 haircut 45 completed   11:00 beard 25 completed
  //           12:00 haircut no-show        13:00 haircut cancelled
  //   11 Mar  nothing
  //   12 Mar  00:30 haircut 45 completed   15:00 beard confirmed
  //           16:00 kids pending
  //   13 Mar  23:45 haircut 45 completed
  //
  // plus one completed haircut just outside each end of the range.
  beforeEach(async () => {
    const bookings: [string, string, Service, BookingStatus, Barber][] = [
      ["2026-03-10", "10:00", haircut, "COMPLETED", giorgi],
      ["2026-03-10", "11:00", beardTrim, "COMPLETED", giorgi],
      ["2026-03-10", "12:00", haircut, "NO_SHOW", giorgi],
      ["2026-03-10", "13:00", haircut, "CANCELLED", giorgi],
      ["2026-03-12", "00:30", haircut, "COMPLETED", luka],
      ["2026-03-12", "15:00", beardTrim, "CONFIRMED", luka],
      ["2026-03-12", "16:00", kidsHaircut, "PENDING", luka],
      ["2026-03-13", "23:45", haircut, "COMPLETED", giorgi],
      ["2026-03-09", "23:45", haircut, "COMPLETED", luka],
      ["2026-03-14", "00:15", haircut, "COMPLETED", luka],
    ];
    for (const [date, time, service, status, barber] of bookings) {
      await insertBooking(at(date, time), { service, status, barber });
    }
  });

  const overview = async (from = "2026-03-10", to = "2026-03-13") =>
    (await asAdmin.get("/admin/overview").query({ from, to })).body;

  it("counts bookings and revenue per shop day, including empty days", async () => {
    const { perDay, totals } = await overview();

    expect(perDay).toEqual([
      // Three bookings (the cancelled one isn't counted); 45 + 25 earned.
      { date: "2026-03-10", bookings: 3, revenueCents: 7000 },
      { date: "2026-03-11", bookings: 0, revenueCents: 0 },
      // 00:30 belongs to the 12th in the shop, whatever the date is in UTC.
      { date: "2026-03-12", bookings: 3, revenueCents: 4500 },
      { date: "2026-03-13", bookings: 1, revenueCents: 4500 },
    ]);
    expect(totals).toEqual({ bookings: 7, revenueCents: 16000 });
  });

  it("counts revenue for completed bookings only", async () => {
    const { perDay } = await overview("2026-03-12", "2026-03-12");

    // Confirmed and pending bookings are booked, but not yet earned.
    expect(perDay).toEqual([{ date: "2026-03-12", bookings: 3, revenueCents: 4500 }]);
  });

  it("counts bookings by status", async () => {
    const { byStatus } = await overview();

    expect(byStatus).toEqual({ pending: 1, confirmed: 1, completed: 4, cancelled: 1, no_show: 1 });
  });

  it("works out the no-show rate from appointments that reached their time", async () => {
    // 1 no-show out of 4 completed + 1 no-show.
    expect((await overview()).noShowRate).toBeCloseTo(0.2);
    // A day with no outcomes yet has no rate rather than a rate of zero.
    expect((await overview("2026-03-11", "2026-03-11")).noShowRate).toBeNull();
  });

  it("ranks the most booked services, leaving out cancelled bookings", async () => {
    const { topServices } = await overview();

    expect(topServices).toEqual([
      { serviceId: haircut.id, name: "Haircut", bookings: 4 },
      { serviceId: beardTrim.id, name: "Beard trim", bookings: 2 },
      { serviceId: kidsHaircut.id, name: "Kids haircut", bookings: 1 },
    ]);
  });

  it("includes the bookings at the edges when the range is widened", async () => {
    const { totals, perDay } = await overview("2026-03-09", "2026-03-14");

    expect(perDay).toHaveLength(6);
    expect(totals).toEqual({ bookings: 9, revenueCents: 25000 });
  });

  it("rejects a backwards or over-long range", async () => {
    const backwards = await asAdmin
      .get("/admin/overview")
      .query({ from: "2026-03-13", to: "2026-03-10" });
    const tooLong = await asAdmin
      .get("/admin/overview")
      .query({ from: "2025-01-01", to: "2026-03-10" });

    expect(backwards.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });
});
