import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type {
  Barber,
  BookingStatus,
  PaymentStatus,
  Service,
  User,
} from "../src/generated/prisma/client.ts";
import type { Dependencies } from "../src/dependencies.ts";
import type { FakePaymentProvider } from "../src/payments/fake.ts";
import { PaymentProviders } from "../src/payments/index.ts";
import { handlePaymentEvent } from "../src/payments/service.ts";
import { StripePaymentProvider } from "../src/payments/stripe.ts";
import { addDays, shopDateOf, shopTimeToUtc } from "../src/shop/time.ts";
import {
  authHeaderFor,
  authHeaderForBarber,
  createBarber,
  createService,
  createTestDependencies,
  createUser,
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
let app: Express;
let barber: Barber;
let haircut: Service;
let davit: User;
let nino: User;
let davitAuth: string;
let ninoAuth: string;

beforeEach(async () => {
  await resetDatabase();
  ({ deps, fake: payments } = createTestDependencies());
  app = createApp(deps);
  barber = await createBarber("Giorgi Kapanadze");
  haircut = await createService("Haircut");
  davit = await createUser("davit@dalaki.example");
  nino = await createUser("nino@dalaki.example");
  davitAuth = await authHeaderFor(davit);
  ninoAuth = await authHeaderFor(nino);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function book(auth: string, clockTime: string, serviceId = haircut.id) {
  return request(app)
    .post("/bookings")
    .set("Authorization", auth)
    .send({ barberId: barber.id, serviceId, startsAt: at(clockTime).toISOString() });
}

function insertBooking(
  startsAt: Date,
  state: {
    status?: BookingStatus;
    paymentStatus?: PaymentStatus;
    paymentSessionId?: string;
    paymentId?: string;
    paymentProvider?: string;
    holdExpiresAt?: Date;
    customer?: User;
  } = {},
) {
  const { customer = davit, ...fields } = state;
  return prisma.booking.create({
    data: {
      customerId: customer.id,
      barberId: barber.id,
      serviceId: haircut.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * MINUTE_MS),
      priceCents: haircut.priceCents,
      depositCents: haircut.depositCents,
      ...fields,
    },
  });
}

const insertPaidBooking = (startsAt: Date, paymentProvider = "fake") =>
  insertBooking(startsAt, {
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentId: "pi_paid",
    paymentProvider,
  });

const reload = (bookingId: string) =>
  prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

async function freeTimes(): Promise<string[]> {
  const response = await request(app)
    .get("/availability")
    .query({ barberId: barber.id, serviceId: haircut.id, date: DATE });
  return response.body.slots.map((slot: { localTime: string }) => slot.localTime);
}

describe("booking with a deposit", () => {
  it("creates a pending booking and a checkout for the deposit", async () => {
    const before = Date.now();

    const response = await book(davitAuth, "10:00");

    expect(response.status).toBe(201);
    expect(response.body.booking).toMatchObject({ status: "pending", paymentStatus: "unpaid" });
    expect(response.body.booking.heldUntilLocalTime).toMatch(/^\d{2}:\d{2}$/);

    const [[sessionId, checkout] = []] = payments.checkouts;
    expect(response.body.checkoutUrl).toBe(`http://shop.test/pay/${sessionId}`);
    expect(response.body.booking.paymentUrl).toBe(response.body.checkoutUrl);
    expect(checkout).toMatchObject({
      bookingId: response.body.booking.id,
      amountCents: 1000,
      currency: "gel",
      customerEmail: "davit@dalaki.example",
    });
    expect(checkout?.description).toContain("Haircut with Giorgi Kapanadze");

    const saved = await reload(response.body.booking.id);
    expect(saved.paymentSessionId).toBe(sessionId);
    expect(saved.paymentProvider).toBe("fake");
    const heldForMinutes = ((saved.holdExpiresAt?.getTime() ?? 0) - before) / MINUTE_MS;
    expect(heldForMinutes).toBeGreaterThanOrEqual(30);
    expect(heldForMinutes).toBeLessThan(31);
    expect(checkout?.expiresAt).toEqual(saved.holdExpiresAt);
  });

  it("confirms at once when the service has no deposit", async () => {
    const free = await prisma.service.create({
      data: { name: "Consultation", durationMinutes: 15, priceCents: 0, depositCents: 0 },
    });

    const response = await book(davitAuth, "10:00", free.id);

    expect(response.status).toBe(201);
    expect(response.body.booking.status).toBe("confirmed");
    expect(response.body.checkoutUrl).toBeNull();
    expect(payments.checkouts.size).toBe(0);
  });

  it("books nothing when the payment can't be started", async () => {
    const errorLog = silenceErrorLog();
    payments.failCheckouts = true;

    const response = await book(davitAuth, "10:00");

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("Could not start the deposit payment"),
      expect.any(Error),
    );
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("PAYMENT_UNAVAILABLE");
    expect(await freeTimes()).toContain("10:00");
    expect((await request(app).get("/bookings/mine").set("Authorization", davitAuth)).body).toEqual({
      upcoming: [],
      past: [],
    });
  });

  it("confirms the booking when the fake checkout is paid", async () => {
    const { booking, checkoutUrl } = (await book(davitAuth, "10:00")).body;
    const checkoutPath = new URL(checkoutUrl).pathname.replace("/pay/", "/payments/fake-checkout/");

    const page = await request(app).get(checkoutPath);
    const paid = await request(app).post(checkoutPath);

    expect(page.status).toBe(200);
    expect(page.text).toContain("10.00 GEL");
    expect(paid.status).toBe(303);
    expect(paid.headers.location).toBe(`${env.appUrl}/bookings?paid=${booking.id}`);
    expect(await reload(booking.id)).toMatchObject({
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentId: expect.stringMatching(/^fake_pay_/),
      holdExpiresAt: null,
    });
  });
});

describe("the Stripe webhook", () => {
  const stripe = new StripePaymentProvider({
    secretKey: "sk_test_not_a_real_key",
    webhookSecret: "whsec_test_secret",
  });
  const stripeApp = createApp({
    ...createTestDependencies().deps,
    payments: new PaymentProviders(stripe),
  });

  function event(type: string, session: object) {
    return JSON.stringify({
      id: "evt_test_1",
      object: "event",
      type,
      data: { object: { object: "checkout.session", ...session } },
    });
  }

  const paidEvent = event("checkout.session.completed", {
    id: "cs_test_1",
    payment_status: "paid",
    payment_intent: "pi_test_1",
  });

  function send(payload: string, signature: string | null = stripe.signForTest(payload)) {
    const pending = request(stripeApp)
      .post("/payments/webhook")
      .set("Content-Type", "application/json");
    return (signature === null ? pending : pending.set("Stripe-Signature", signature)).send(payload);
  }

  const insertPending = () =>
    insertBooking(at("10:00"), {
      paymentSessionId: "cs_test_1",
      holdExpiresAt: new Date(Date.now() + 30 * MINUTE_MS),
    });

  it("confirms the booking for a valid payment event", async () => {
    const booking = await insertPending();

    const response = await send(paidEvent);

    expect(response.status).toBe(200);
    expect(await reload(booking.id)).toMatchObject({
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentId: "pi_test_1",
      holdExpiresAt: null,
    });
  });

  it.each([
    ["a signature made with another secret", "t=1700000000,v1=0000000000000000"],
    ["no signature at all", null],
  ])("rejects an event with %s and changes nothing", async (_case, signature) => {
    const booking = await insertPending();

    const response = await send(paidEvent, signature);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");
    expect((await reload(booking.id)).status).toBe("PENDING");
  });

  it("rejects a body that was changed after it was signed", async () => {
    const booking = await insertPending();
    const signature = stripe.signForTest(paidEvent);

    const response = await send(paidEvent.replace("pi_test_1", "pi_attacker"), signature);

    expect(response.status).toBe(400);
    expect((await reload(booking.id)).status).toBe("PENDING");
  });

  it("changes nothing when the same event arrives again", async () => {
    const booking = await insertPending();
    await send(paidEvent);
    const afterFirst = await reload(booking.id);

    const repeat = await send(paidEvent);

    expect(repeat.status).toBe(200);
    expect(await reload(booking.id)).toEqual(afterFirst);
  });

  it("does not revive a cancelled booking when its event is repeated", async () => {
    const booking = await insertPending();
    await send(paidEvent);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", paymentStatus: "REFUNDED" },
    });

    await send(paidEvent);

    expect(await reload(booking.id)).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
    });
  });

  it("expires the booking when Stripe says the checkout ran out", async () => {
    const booking = await insertPending();

    const response = await send(event("checkout.session.expired", { id: "cs_test_1" }));

    expect(response.status).toBe(200);
    expect((await reload(booking.id)).status).toBe("EXPIRED");
  });

  it("accepts and ignores events it has no use for", async () => {
    const booking = await insertPending();

    const unrelated = await send(event("customer.created", { id: "cus_1" }));
    const unknownSession = await send(paidEvent.replaceAll("cs_test_1", "cs_someone_else"));
    const unpaid = await send(
      event("checkout.session.completed", { id: "cs_test_1", payment_status: "unpaid" }),
    );

    expect([unrelated.status, unknownSession.status, unpaid.status]).toEqual([200, 200, 200]);
    expect((await reload(booking.id)).status).toBe("PENDING");
  });
});

describe("an unpaid booking's hold on its slot", () => {
  const letTheHoldLapse = (bookingId: string) =>
    prisma.booking.update({
      where: { id: bookingId },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });

  it("keeps the slot while the hold lasts", async () => {
    await book(davitAuth, "10:00");

    expect(await freeTimes()).not.toContain("10:00");
    expect((await book(ninoAuth, "10:00")).status).toBe(409);
  });

  it("frees the slot once the hold has run out", async () => {
    const { booking } = (await book(davitAuth, "10:00")).body;
    await letTheHoldLapse(booking.id);

    expect(await freeTimes()).toContain("10:00");
    expect((await reload(booking.id)).status).toBe("EXPIRED");

    expect((await book(ninoAuth, "10:00")).status).toBe(201);
    const mine = await request(app).get("/bookings/mine").set("Authorization", davitAuth);
    expect(mine.body.upcoming).toEqual([]);
  });

  it("never expires a booking that has been paid", async () => {
    const { booking } = (await book(davitAuth, "10:00")).body;
    await handlePaymentEvent(deps, {
      type: "payment_succeeded",
      sessionId: (await reload(booking.id)).paymentSessionId ?? "",
      paymentId: "pi_1",
    });
    await letTheHoldLapse(booking.id);

    expect(await freeTimes()).not.toContain("10:00");
    expect((await reload(booking.id)).status).toBe("CONFIRMED");
  });

  describe("when the payment arrives after the hold ran out", () => {
    async function expiredBooking() {
      const { booking } = (await book(davitAuth, "10:00")).body;
      await letTheHoldLapse(booking.id);
      await freeTimes();
      return reload(booking.id);
    }

    const payLate = (sessionId: string | null) =>
      handlePaymentEvent(deps, {
        type: "payment_succeeded",
        sessionId: sessionId ?? "",
        paymentId: "pi_late",
      });

    it("confirms the booking if the slot is still free", async () => {
      const booking = await expiredBooking();

      await payLate(booking.paymentSessionId);

      expect(await reload(booking.id)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
      expect(payments.refunds).toEqual([]);
    });

    it("refunds the deposit if someone else has taken the slot", async () => {
      const booking = await expiredBooking();
      await book(ninoAuth, "10:00");

      await payLate(booking.paymentSessionId);

      expect(await reload(booking.id)).toMatchObject({
        status: "EXPIRED",
        paymentStatus: "REFUNDED",
        paymentId: "pi_late",
      });
      expect(payments.refunds).toEqual([
        { paymentId: "pi_late", idempotencyKey: `refund-${booking.id}` },
      ]);

      await payLate(booking.paymentSessionId);
      expect(payments.refunds).toHaveLength(1);
    });
  });
});

describe("cancelling and the deposit", () => {
  const cancel = (auth: string, bookingId: string) =>
    request(app).post(`/bookings/${bookingId}/cancel`).set("Authorization", auth);

  it("refunds the deposit when cancelled 24 hours or more before the start", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 25 * HOUR_MS));

    const response = await cancel(davitAuth, booking.id);

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({
      status: "cancelled",
      cancelledInFreeWindow: true,
      paymentStatus: "refunded",
    });
    expect(payments.refunds).toEqual([
      { paymentId: "pi_paid", idempotencyKey: `refund-${booking.id}` },
    ]);
  });

  it("keeps the deposit when cancelled less than 24 hours before the start", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 23 * HOUR_MS));

    const response = await cancel(davitAuth, booking.id);

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({
      status: "cancelled",
      cancelledInFreeWindow: false,
      paymentStatus: "paid",
    });
    expect(payments.refunds).toEqual([]);
  });

  it("draws the line at exactly 24 hours", async () => {
    const justInside = await insertPaidBooking(new Date(Date.now() + 24 * HOUR_MS + MINUTE_MS));
    await cancel(davitAuth, justInside.id);
    const justOutside = await insertPaidBooking(new Date(Date.now() + 24 * HOUR_MS - MINUTE_MS));
    await cancel(davitAuth, justOutside.id);

    expect((await reload(justInside.id)).paymentStatus).toBe("REFUNDED");
    expect((await reload(justOutside.id)).paymentStatus).toBe("PAID");
  });

  it("refunds nothing for a booking that was never paid, and closes its checkout", async () => {
    const { booking } = (await book(davitAuth, "10:00")).body;
    const { paymentSessionId } = await reload(booking.id);

    const response = await cancel(davitAuth, booking.id);

    expect(response.body.booking).toMatchObject({ status: "cancelled", paymentStatus: "unpaid" });
    expect(payments.refunds).toEqual([]);
    expect(payments.expiredSessionIds).toEqual([paymentSessionId]);
  });

  it("still cancels the booking when the refund fails, and records the failure", async () => {
    const errorLog = silenceErrorLog();
    const booking = await insertPaidBooking(new Date(Date.now() + 48 * HOUR_MS));
    payments.failRefunds = true;

    const response = await cancel(davitAuth, booking.id);

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("Refund failed"),
      expect.any(Error),
    );
    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({
      status: "cancelled",
      paymentStatus: "refund_failed",
    });
  });
});

describe("which provider a refund goes through", () => {
  const stripe = new StripePaymentProvider({
    secretKey: "sk_test_not_a_real_key",
    webhookSecret: "whsec_test_secret",
  });
  let withStripeActive: Express;

  beforeEach(() => {
    withStripeActive = createApp({ ...deps, payments: new PaymentProviders(stripe, [payments]) });
  });

  const cancel = (bookingId: string) =>
    request(withStripeActive).post(`/bookings/${bookingId}/cancel`).set("Authorization", davitAuth);

  it("refunds a deposit the fake provider took through the fake, even with Stripe active", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 48 * HOUR_MS), "fake");

    const response = await cancel(booking.id);

    expect(response.body.booking.paymentStatus).toBe("refunded");
    expect(payments.refunds).toEqual([
      { paymentId: "pi_paid", idempotencyKey: `refund-${booking.id}` },
    ]);
  });

  it("records a failed refund when the deposit's provider is no longer configured", async () => {
    const errorLog = silenceErrorLog();
    const booking = await insertPaidBooking(new Date(Date.now() + 48 * HOUR_MS), "retired-provider");

    const response = await cancel(booking.id);

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("Refund failed"),
      expect.any(Error),
    );
    expect(response.body.booking).toMatchObject({
      status: "cancelled",
      paymentStatus: "refund_failed",
    });
    expect(payments.refunds).toEqual([]);
  });

  it("closes an unpaid checkout at the provider that opened it", async () => {
    const pending = await insertBooking(at("10:00"), {
      paymentSessionId: "fake_cs_open",
      paymentProvider: "fake",
      holdExpiresAt: new Date(Date.now() + 30 * MINUTE_MS),
    });

    await cancel(pending.id);

    expect(payments.expiredSessionIds).toEqual(["fake_cs_open"]);
  });
});

describe("rescheduling", () => {
  const reschedule = (bookingId: string, clockTime: string) =>
    request(app)
      .post(`/bookings/${bookingId}/reschedule`)
      .set("Authorization", davitAuth)
      .send({ startsAt: at(clockTime).toISOString() });

  it("is refused less than 24 hours before the start", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 23 * HOUR_MS));

    const response = await reschedule(booking.id, "15:00");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TOO_LATE_TO_RESCHEDULE");
    expect((await reload(booking.id)).startsAt).toEqual(booking.startsAt);
  });

  it("is allowed 24 hours or more before the start", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 25 * HOUR_MS));

    const response = await reschedule(booking.id, "15:00");

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({ localTime: "15:00", paymentStatus: "paid" });
  });

  it("is refused until the deposit has been paid", async () => {
    const { booking } = (await book(davitAuth, "10:00")).body;

    const response = await reschedule(booking.id, "15:00");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BOOKING_NOT_ACTIVE");
  });
});

describe("staff and payments", () => {
  let adminAuth: string;

  beforeEach(async () => {
    adminAuth = await authHeaderFor(await createUser("tamar@dalaki.example", "ADMIN"));
  });

  const cancelAsAdmin = (bookingId: string, body?: object) =>
    request(app)
      .post(`/admin/bookings/${bookingId}/cancel`)
      .set("Authorization", adminAuth)
      .send(body);

  it("refunds by default when the admin cancels, however late", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 2 * HOUR_MS));

    const response = await cancelAsAdmin(booking.id);

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({ status: "cancelled", paymentStatus: "refunded" });
    expect(payments.refunds).toHaveLength(1);
  });

  it("keeps the deposit when the admin chooses not to refund, however early", async () => {
    const booking = await insertPaidBooking(new Date(Date.now() + 72 * HOUR_MS));

    const response = await cancelAsAdmin(booking.id, { refund: false });

    expect(response.status).toBe(200);
    expect(response.body.booking).toMatchObject({ status: "cancelled", paymentStatus: "paid" });
    expect(payments.refunds).toEqual([]);
  });

  it("does not let a barber record an outcome for an unpaid booking", async () => {
    const pending = await insertBooking(new Date(Date.now() - HOUR_MS), { status: "PENDING" });

    const response = await request(app)
      .post(`/barber/bookings/${pending.id}/complete`)
      .set("Authorization", await authHeaderForBarber(barber));

    expect(response.status).toBe(409);
    expect((await reload(pending.id)).status).toBe("PENDING");
  });
});
