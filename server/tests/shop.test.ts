import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import { bookingForEmail, confirmationEmail } from "../src/notifications/emails.ts";
import { addDays, shopDateOf, shopTimeToUtc } from "../src/shop/time.ts";
import {
  createBarber,
  createService,
  createTestDependencies,
  createUser,
  resetDatabase,
} from "./helpers.ts";

const app = createApp(createTestDependencies().deps);

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /shop", () => {
  it("returns the time zone, today's shop date, the booking limits and where the shop is", async () => {
    const response = await request(app).get("/shop");

    const today = shopDateOf(new Date(), env.shopTimeZone);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      timeZone: env.shopTimeZone,
      today,
      lastBookableDate: addDays(today, 60),
      freeCancellationHours: 24,
      address: {
        street: "27 Lado Asatiani Street",
        district: "Sololaki",
        city: "Tbilisi 0105",
      },
      directions: "Five minutes on foot from Liberty Square metro.",
      phone: "+995 555 00 00 00",
    });
  });

  it("gives the address and phone that the emails print", async () => {
    const barber = await createBarber("Marco Rossi");
    const haircut = await createService("Haircut");
    const alex = await createUser("alex@example.test");
    const startsAt = shopTimeToUtc(addDays(shopDateOf(new Date(), env.shopTimeZone), 7), 10 * 60, env.shopTimeZone);
    const { id } = await prisma.booking.create({
      data: {
        customerId: alex.id,
        barberId: barber.id,
        serviceId: haircut.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
        status: "CONFIRMED",
        priceCents: haircut.priceCents,
        depositCents: haircut.depositCents,
      },
    });
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: bookingForEmail,
    });

    const { address, phone } = (await request(app).get("/shop")).body;
    const email = confirmationEmail(booking, 24);

    expect(email.text).toContain(`${address.street}, ${address.district}, ${address.city}`);
    expect(email.text).toContain(phone);
    expect(email.html).toContain(phone);
  });
});
