import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type { Barber, BookingStatus, Service, User } from "../src/generated/prisma/client.ts";
import { deleteDeadRefreshTokens } from "../src/jobs/cleanup.ts";
import { sendDailySummary } from "../src/jobs/dailySummary.ts";
import { sendReminders } from "../src/jobs/reminders.ts";
import { expireUnpaidBookings } from "../src/payments/service.ts";
import { addDays, shopDateOf, shopTimeToUtc, weekdayOf } from "../src/shop/time.ts";
import {
  createBarber,
  createService,
  createUser,
  RecordingMailer,
  RecordingOwnerAlerts,
  resetDatabase,
} from "./helpers.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TODAY = shopDateOf(new Date(), env.shopTimeZone);
const TOMORROW = addDays(TODAY, 1);

function at(shopDate: string, clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return shopTimeToUtc(shopDate, (hours ?? 0) * 60 + (minutes ?? 0), env.shopTimeZone);
}

let mailer: RecordingMailer;
let ownerAlerts: RecordingOwnerAlerts;
let barber: Barber;
let haircut: Service;
let davit: User;

beforeEach(async () => {
  await resetDatabase();
  await prisma.dailySummary.deleteMany();
  mailer = new RecordingMailer();
  ownerAlerts = new RecordingOwnerAlerts();
  barber = await createBarber("Luka Gelashvili");
  haircut = await createService("Haircut");
  davit = await prisma.user.update({
    where: { id: (await createUser("davit@dalaki.example")).id },
    data: { name: "Davit Maisuradze" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

type BookingState = {
  status?: BookingStatus;
  createdAt?: Date;
  cancelledAt?: Date;
  holdExpiresAt?: Date;
};

function insertBooking(startsAt: Date, state: BookingState = {}) {
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
      createdAt: new Date(Date.now() - 2 * DAY_MS),
      ...state,
    },
  });
}

describe("reminders", () => {
  const MIDDAY = at(TODAY, "12:00");

  it("emails a customer whose confirmed appointment is tomorrow", async () => {
    await insertBooking(at(TOMORROW, "11:00"));

    const sent = await sendReminders({ mailer }, MIDDAY);

    expect(sent).toBe(1);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("davit@dalaki.example");
    expect(mailer.sent[0]?.subject).toBe("Tomorrow at 11:00: your appointment at Dalaki");
    expect(mailer.sent[0]?.text).toContain("Luka Gelashvili is expecting you tomorrow at 11:00");
  });

  it("sends each reminder once, however often the job runs", async () => {
    await insertBooking(at(TOMORROW, "11:00"));

    const first = await sendReminders({ mailer }, MIDDAY);
    const second = await sendReminders({ mailer }, MIDDAY);
    const later = await sendReminders({ mailer }, at(TODAY, "17:00"));

    expect([first, second, later]).toEqual([1, 0, 0]);
    expect(mailer.sent).toHaveLength(1);
  });

  it("sends once even when two runs overlap", async () => {
    await insertBooking(at(TOMORROW, "11:00"));
    await insertBooking(at(TOMORROW, "15:00"));

    const counts = await Promise.all([
      sendReminders({ mailer }, MIDDAY),
      sendReminders({ mailer }, MIDDAY),
      sendReminders({ mailer }, MIDDAY),
    ]);

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(mailer.sent).toHaveLength(2);
  });

  it("reminds only for confirmed appointments that are tomorrow", async () => {
    await insertBooking(at(TOMORROW, "09:00"), { status: "CANCELLED" });
    await insertBooking(at(TOMORROW, "10:00"), { status: "PENDING" });
    await insertBooking(at(TODAY, "16:00"));
    await insertBooking(at(addDays(TODAY, 2), "11:00"));
    await insertBooking(at(TOMORROW, "14:00"), { createdAt: at(TODAY, "09:30") });

    expect(await sendReminders({ mailer }, MIDDAY)).toBe(0);
    expect(mailer.sent).toEqual([]);
  });

  it("waits until mid-morning", async () => {
    await insertBooking(at(TOMORROW, "11:00"));

    expect(await sendReminders({ mailer }, at(TODAY, "08:00"))).toBe(0);
    expect(await sendReminders({ mailer }, at(TODAY, "10:00"))).toBe(1);
  });

  it("tries again later when the mail server was down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const booking = await insertBooking(at(TOMORROW, "11:00"));
    mailer.failing = true;

    const whileDown = await sendReminders({ mailer }, MIDDAY);

    expect(whileDown).toBe(0);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).reminderSentAt,
    ).toBeNull();

    mailer.failing = false;
    expect(await sendReminders({ mailer }, MIDDAY)).toBe(1);
    expect(await sendReminders({ mailer }, MIDDAY)).toBe(0);
    expect(mailer.sent).toHaveLength(1);
  });
});

describe("the daily summary", () => {
  const AFTER_CLOSING = at(TODAY, "18:05");

  beforeEach(async () => {
    await insertBooking(at(TODAY, "09:00"), { status: "COMPLETED" });
    await insertBooking(at(TODAY, "10:00"), { status: "COMPLETED" });
    await insertBooking(at(TODAY, "11:00"), { status: "NO_SHOW" });
    await insertBooking(at(TODAY, "12:00"));
    await insertBooking(at(TODAY, "15:00"), {
      status: "CANCELLED",
      cancelledAt: at(TODAY, "08:00"),
    });
    await insertBooking(at(TOMORROW, "11:00"));
  });

  it("sends the owner the day's figures after closing time", async () => {
    const sent = await sendDailySummary({ ownerAlerts }, AFTER_CLOSING);

    expect(sent).toBe(true);
    expect(ownerAlerts.sent).toHaveLength(1);
    const lines = ownerAlerts.sent[0]?.split("\n") ?? [];
    expect(lines[0]).toMatch(/^Dalaki, \w+ \d+ \w+$/);
    expect(lines.slice(1)).toEqual([
      "Completed: 2 (50 ₾)",
      "No-shows: 1",
      "Not marked yet: 1",
      "Cancellations made today: 1",
      "Booked for tomorrow: 1",
    ]);
  });

  it("waits for closing time", async () => {
    expect(await sendDailySummary({ ownerAlerts }, at(TODAY, "17:55"))).toBe(false);
    expect(ownerAlerts.sent).toEqual([]);
  });

  it("sends one a day, however often the job runs", async () => {
    const runs = [
      await sendDailySummary({ ownerAlerts }, AFTER_CLOSING),
      await sendDailySummary({ ownerAlerts }, AFTER_CLOSING),
      await sendDailySummary({ ownerAlerts }, at(TODAY, "23:00")),
    ];

    expect(runs).toEqual([true, false, false]);
    expect(ownerAlerts.sent).toHaveLength(1);
  });

  it("sends one even when two runs overlap", async () => {
    const runs = await Promise.all([
      sendDailySummary({ ownerAlerts }, AFTER_CLOSING),
      sendDailySummary({ ownerAlerts }, AFTER_CLOSING),
    ]);

    expect(runs.filter(Boolean)).toHaveLength(1);
    expect(ownerAlerts.sent).toHaveLength(1);
  });

  it("sends nothing on a day the shop is closed", async () => {
    await prisma.workingHours.deleteMany({ where: { weekday: weekdayOf(TODAY) } });

    expect(await sendDailySummary({ ownerAlerts }, AFTER_CLOSING)).toBe(false);
  });

  it("tries again later when Telegram was down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ownerAlerts.failing = true;

    expect(await sendDailySummary({ ownerAlerts }, AFTER_CLOSING)).toBe(false);

    ownerAlerts.failing = false;
    expect(await sendDailySummary({ ownerAlerts }, AFTER_CLOSING)).toBe(true);
    expect(ownerAlerts.sent).toHaveLength(1);
  });
});

describe("expiring unpaid bookings", () => {
  it("expires the holds that have run out and leaves the rest", async () => {
    const now = new Date();
    const lapsed = await insertBooking(at(TOMORROW, "10:00"), {
      status: "PENDING",
      holdExpiresAt: new Date(now.getTime() - MINUTE_MS),
    });
    const held = await insertBooking(at(TOMORROW, "11:00"), {
      status: "PENDING",
      holdExpiresAt: new Date(now.getTime() + 10 * MINUTE_MS),
    });
    const confirmed = await insertBooking(at(TOMORROW, "12:00"));

    const expired = await expireUnpaidBookings(now);

    expect(expired).toBe(1);
    const statusOf = async (id: string) =>
      (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
    expect(await statusOf(lapsed.id)).toBe("EXPIRED");
    expect(await statusOf(held.id)).toBe("PENDING");
    expect(await statusOf(confirmed.id)).toBe("CONFIRMED");
    expect(await expireUnpaidBookings(now)).toBe(0);
  });
});

describe("deleting dead refresh tokens", () => {
  it("deletes expired tokens and long-revoked ones, and keeps the rest", async () => {
    const now = new Date();
    const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY_MS);
    const token = (tokenHash: string, expiresAt: Date, revokedAt?: Date) =>
      prisma.refreshToken.create({ data: { userId: davit.id, tokenHash, expiresAt, revokedAt } });

    await token("in-use", daysFromNow(20));
    await token("expired", daysFromNow(-1));
    await token("revoked-yesterday", daysFromNow(20), daysFromNow(-1));
    await token("revoked-last-month", daysFromNow(20), daysFromNow(-8));
    await token("expired-and-revoked", daysFromNow(-2), daysFromNow(-3));

    const deleted = await deleteDeadRefreshTokens(now);

    expect(deleted).toBe(3);
    const left = await prisma.refreshToken.findMany({ orderBy: { tokenHash: "asc" } });
    expect(left.map((row) => row.tokenHash)).toEqual(["in-use", "revoked-yesterday"]);
  });
});
