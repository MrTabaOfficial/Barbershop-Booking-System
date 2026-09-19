import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import type { Dependencies } from "../src/dependencies.ts";
import { env } from "../src/env.ts";
import type { Barber, Service, User } from "../src/generated/prisma/client.ts";
import { LogMailer } from "../src/notifications/mailer.ts";
import { LogOwnerAlerts } from "../src/notifications/ownerAlerts.ts";
import type { FakePaymentProvider } from "../src/payments/fake.ts";
import { handlePaymentEvent } from "../src/payments/service.ts";
import { addDays, shopDateOf, shopTimeToUtc } from "../src/shop/time.ts";
import {
  authHeaderFor,
  createBarber,
  createService,
  createTestDependencies,
  createUser,
  type RecordingMailer,
  type RecordingOwnerAlerts,
  resetDatabase,
  silenceErrorLog,
} from "./helpers.ts";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DATE = addDays(shopDateOf(new Date(), env.shopTimeZone), 7);

function at(clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return shopTimeToUtc(DATE, (hours ?? 0) * 60 + (minutes ?? 0), env.shopTimeZone);
}

let deps: Dependencies;
let payments: FakePaymentProvider;
let mailer: RecordingMailer;
let ownerAlerts: RecordingOwnerAlerts;
let app: Express;
let barber: Barber;
let haircut: Service;
let davit: User;
let davitAuth: string;
let adminAuth: string;

beforeEach(async () => {
  await resetDatabase();
  ({ deps, fake: payments, mailer, ownerAlerts } = createTestDependencies());
  app = createApp(deps);
  barber = await createBarber("Luka Gelashvili");
  haircut = await createService("Haircut");
  davit = await prisma.user.update({
    where: { id: (await createUser("davit@dalaki.example")).id },
    data: { name: "Davit Maisuradze", phone: "+995 555 01 01 01" },
  });
  davitAuth = await authHeaderFor(davit);
  adminAuth = await authHeaderFor(await createUser("tamar@dalaki.example", "ADMIN"));
});

afterAll(async () => {
  await prisma.$disconnect();
});

const reload = (bookingId: string) =>
  prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

async function book(): Promise<string> {
  const response = await request(app)
    .post("/bookings")
    .set("Authorization", davitAuth)
    .send({ barberId: barber.id, serviceId: haircut.id, startsAt: at("10:00").toISOString() });
  return response.body.booking.id;
}

async function pay(bookingId: string) {
  const { paymentSessionId } = await reload(bookingId);
  await handlePaymentEvent(deps, {
    type: "payment_succeeded",
    sessionId: paymentSessionId ?? "",
    paymentId: "pi_1",
  });
}

function insertPaidBooking(hoursFromNow: number) {
  const startsAt = new Date(Date.now() + hoursFromNow * HOUR_MS);
  return prisma.booking.create({
    data: {
      customerId: davit.id,
      barberId: barber.id,
      serviceId: haircut.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * MINUTE_MS),
      priceCents: haircut.priceCents,
      depositCents: haircut.depositCents,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentId: "pi_paid",
      paymentProvider: "fake",
    },
  });
}

const cancel = (bookingId: string) =>
  request(app).post(`/bookings/${bookingId}/cancel`).set("Authorization", davitAuth);

const cancelAsAdmin = (bookingId: string, body?: object) =>
  request(app)
    .post(`/admin/bookings/${bookingId}/cancel`)
    .set("Authorization", adminAuth)
    .send(body);

describe("when a booking is confirmed", () => {
  it("says nothing while the deposit is unpaid", async () => {
    await book();

    expect(mailer.sent).toEqual([]);
    expect(ownerAlerts.sent).toEqual([]);
  });

  it("emails the customer and alerts the owner once the deposit is paid", async () => {
    await pay(await book());

    expect(mailer.sent).toHaveLength(1);
    const [email] = mailer.sent;
    expect(email?.to).toBe("davit@dalaki.example");
    expect(email?.subject).toBe("Your booking at Dalaki is confirmed");
    expect(email?.text).toContain("Thank you, Davit.");
    expect(email?.text).toContain("Service: Haircut");
    expect(email?.text).toContain("Barber: Luka Gelashvili");
    expect(email?.text).toMatch(/When: \w+ \d+ \w+ at 10:00 \(\w+ time\)/);
    expect(email?.text).toContain("Deposit paid: 10 ₾");
    expect(email?.text).toContain("To pay at the shop: 15 ₾");
    expect(email?.html).toContain("დალაქი");
    expect(email?.html).toContain("Luka Gelashvili");
    expect(email?.html).toContain("10 ₾");

    expect(ownerAlerts.sent).toHaveLength(1);
    expect(ownerAlerts.sent[0]).toContain("New booking: Haircut with Luka Gelashvili");
    expect(ownerAlerts.sent[0]).toContain("Customer: Davit Maisuradze, +995 555 01 01 01.");
  });

  it("sends nothing more when the payment event is repeated", async () => {
    const bookingId = await book();
    await pay(bookingId);
    await pay(bookingId);

    expect(mailer.sent).toHaveLength(1);
    expect(ownerAlerts.sent).toHaveLength(1);
  });

  it("keeps text a customer typed from being read as HTML", async () => {
    await prisma.user.update({
      where: { id: davit.id },
      data: { name: "<b>Davit</b> Maisuradze" },
    });

    await pay(await book());

    expect(mailer.sent[0]?.html).toContain("&lt;b&gt;Davit&lt;/b&gt;");
    expect(mailer.sent[0]?.html).not.toContain("<b>Davit</b>");
  });
});

describe("when a booking is moved", () => {
  it("emails the customer the new time and the old one", async () => {
    const bookingId = await book();
    await pay(bookingId);
    mailer.sent.length = 0;

    await request(app)
      .post(`/bookings/${bookingId}/reschedule`)
      .set("Authorization", davitAuth)
      .send({ startsAt: at("15:00").toISOString() });

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toBe("Your booking at Dalaki has moved");
    expect(mailer.sent[0]?.text).toMatch(/New time: .+ at 15:00/);
    expect(mailer.sent[0]?.text).toMatch(/Was: .+ at 10:00/);
  });
});

describe("when a booking is cancelled", () => {
  it("tells the customer the deposit was refunded, 24 hours or more before", async () => {
    const booking = await insertPaidBooking(48);

    await cancel(booking.id);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toBe("Your booking at Dalaki is cancelled");
    expect(mailer.sent[0]?.text).toContain("as you asked, we have cancelled your appointment");
    expect(mailer.sent[0]?.text).toContain("Your 10 ₾ deposit has been refunded");
    expect(ownerAlerts.sent[0]).toContain("Cancelled by the customer: Haircut with Luka Gelashvili");
    expect(ownerAlerts.sent[0]).toContain("The 10 ₾ deposit was refunded.");
  });

  it("tells the customer the deposit was kept, less than 24 hours before", async () => {
    const booking = await insertPaidBooking(5);

    await cancel(booking.id);

    expect(mailer.sent[0]?.text).toContain(
      "Because the appointment was less than 24 hours away, the 10 ₾ deposit has been kept.",
    );
    expect(mailer.sent[0]?.text).not.toContain("refunded");
    expect(ownerAlerts.sent[0]).toContain("The 10 ₾ deposit was kept.");
  });

  it("emails the customer when the admin cancels, with the refund", async () => {
    const booking = await insertPaidBooking(5);

    await cancelAsAdmin(booking.id);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("davit@dalaki.example");
    expect(mailer.sent[0]?.text).toContain("we have had to cancel your appointment");
    expect(mailer.sent[0]?.text).toContain("Your 10 ₾ deposit has been refunded");
    expect(ownerAlerts.sent[0]).toContain("Cancelled by the shop");
  });

  it("says the deposit was kept when the admin chooses not to refund", async () => {
    const booking = await insertPaidBooking(48);

    await cancelAsAdmin(booking.id, { refund: false });

    expect(mailer.sent[0]?.text).toContain("The 10 ₾ deposit has been kept.");
  });

  it("owns up when the refund didn't go through", async () => {
    const errorLog = silenceErrorLog();
    const booking = await insertPaidBooking(48);
    payments.failRefunds = true;

    await cancel(booking.id);

    expect(errorLog).toHaveBeenCalled();
    expect(mailer.sent[0]?.text).toContain("the refund did not go through");
    expect(ownerAlerts.sent[0]).toContain("refund FAILED");
  });

  it("says nothing about a booking that was never confirmed", async () => {
    await cancel(await book());

    expect(mailer.sent).toEqual([]);
    expect(ownerAlerts.sent).toEqual([]);
  });
});

describe("when a payment arrives too late to keep the slot", () => {
  it("tells the customer the booking couldn't be confirmed and the deposit is back", async () => {
    const bookingId = await book();
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "EXPIRED", holdExpiresAt: null },
    });
    const other = await createUser("nino@dalaki.example");
    await request(app)
      .post("/bookings")
      .set("Authorization", await authHeaderFor(other))
      .send({ barberId: barber.id, serviceId: haircut.id, startsAt: at("10:00").toISOString() });

    await pay(bookingId);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toBe("We couldn't confirm your booking at Dalaki");
    expect(mailer.sent[0]?.text).toContain("Your 10 ₾ deposit has been refunded");
  });
});

describe("when sending fails", () => {
  beforeEach(() => {
    mailer.failing = true;
    ownerAlerts.failing = true;
    silenceErrorLog();
  });

  it("still confirms the booking", async () => {
    const bookingId = await book();

    await expect(pay(bookingId)).resolves.toBeUndefined();

    expect(await reload(bookingId)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect(console.error).toHaveBeenCalled();
  });

  it("still cancels the booking and refunds the deposit", async () => {
    const booking = await insertPaidBooking(48);

    const response = await cancel(booking.id);

    expect(response.status).toBe(200);
    expect(await reload(booking.id)).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
    });
    expect(payments.refunds).toHaveLength(1);
  });

  it("still moves the booking", async () => {
    const booking = await insertPaidBooking(48);

    const response = await request(app)
      .post(`/bookings/${booking.id}/reschedule`)
      .set("Authorization", davitAuth)
      .send({ startsAt: at("15:00").toISOString() });

    expect(response.status).toBe(200);
    expect((await reload(booking.id)).startsAt).toEqual(at("15:00"));
  });

  it("still lets the admin cancel", async () => {
    const booking = await insertPaidBooking(48);

    const response = await cancelAsAdmin(booking.id);

    expect(response.status).toBe(200);
    expect((await reload(booking.id)).status).toBe("CANCELLED");
  });
});

describe("with nothing configured", () => {
  it("logs an email instead of sending it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await new LogMailer().send({
      to: "davit@dalaki.example",
      subject: "Your booking at Dalaki is confirmed",
      text: "",
      html: "",
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("to davit@dalaki.example: Your booking at Dalaki is confirmed"),
    );
  });

  it("logs an owner alert instead of failing when there is no bot token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(new LogOwnerAlerts().send("New booking: Haircut")).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(expect.stringContaining("New booking: Haircut"));
  });
});
