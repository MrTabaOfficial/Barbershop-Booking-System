import { randomUUID } from "node:crypto";
import type { Response } from "supertest";
import { hashPassword } from "../src/auth/password.ts";
import { REFRESH_COOKIE } from "../src/auth/routes.ts";
import { signAccessToken, toRoleName } from "../src/auth/tokens.ts";
import { prisma } from "../src/db.ts";
import type { Dependencies } from "../src/dependencies.ts";
import { env } from "../src/env.ts";
import type { Role, User } from "../src/generated/prisma/client.ts";
import type { Email, Mailer } from "../src/notifications/mailer.ts";
import type { OwnerAlerts } from "../src/notifications/ownerAlerts.ts";
import { FakePaymentProvider } from "../src/payments/fake.ts";
import { PaymentProviders } from "../src/payments/index.ts";

export const TEST_PASSWORD = "correct-horse-battery";

export async function resetDatabase() {
  if (!new URL(env.databaseUrl).pathname.endsWith("_test")) {
    throw new Error("Refusing to wipe a database whose name doesn't end in _test");
  }
  await prisma.$executeRaw`TRUNCATE TABLE users, services CASCADE`;
}

export async function createUser(email: string, role: Role = "CUSTOMER") {
  return prisma.user.create({
    data: {
      email,
      name: "Test User",
      role,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
}

export function refreshCookieFrom(response: Response): string {
  const setCookie = response.get("Set-Cookie") ?? [];
  const cookie = setCookie.find((value) => value.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) {
    throw new Error("The response did not set a refresh cookie");
  }
  return cookie.split(";")[0] ?? "";
}

export async function authHeaderFor(user: User): Promise<string> {
  const accessToken = await signAccessToken({
    userId: user.id,
    role: toRoleName(user.role),
  });
  return `Bearer ${accessToken}`;
}

export async function createBarber(name = "Test Barber", isActive = true) {
  return prisma.barber.create({
    data: {
      isActive,
      user: {
        create: {
          email: `${randomUUID()}@barbers.test`,
          name,
          role: "BARBER",
          passwordHash: "not-a-real-hash",
        },
      },
      workingHours: {
        create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          startMinute: 9 * 60,
          endMinute: 18 * 60,
          breakStartMinute: 13 * 60,
          breakEndMinute: 14 * 60,
        })),
      },
    },
  });
}

export async function createService(name = "Haircut", isActive = true) {
  return prisma.service.create({
    data: { name, durationMinutes: 30, priceCents: 2500, depositCents: 1000, isActive },
  });
}

export class RecordingMailer implements Mailer {
  readonly name = "recording";
  readonly sent: Email[] = [];
  failing = false;

  async send(email: Email): Promise<void> {
    if (this.failing) {
      throw new Error("The test mail server is down");
    }
    this.sent.push(email);
  }
}

export class RecordingOwnerAlerts implements OwnerAlerts {
  readonly name = "recording";
  readonly sent: string[] = [];
  failing = false;

  async send(text: string): Promise<void> {
    if (this.failing) {
      throw new Error("The test Telegram bot is down");
    }
    this.sent.push(text);
  }
}

export function createTestDependencies() {
  const fake = new FakePaymentProvider((sessionId) => `http://shop.test/pay/${sessionId}`);
  const mailer = new RecordingMailer();
  const ownerAlerts = new RecordingOwnerAlerts();
  const deps: Dependencies = { payments: new PaymentProviders(fake), mailer, ownerAlerts };
  return { deps, fake, mailer, ownerAlerts };
}

export function markAsPaid(bookingId: string) {
  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paymentId: `pay_${bookingId}`,
      paymentProvider: "fake",
      holdExpiresAt: null,
    },
  });
}

export async function authHeaderForBarber(barber: { userId: string }): Promise<string> {
  return authHeaderFor(await prisma.user.findUniqueOrThrow({ where: { id: barber.userId } }));
}
