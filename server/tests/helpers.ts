import { randomUUID } from "node:crypto";
import type { Response } from "supertest";
import { hashPassword } from "../src/auth/password.ts";
import { REFRESH_COOKIE } from "../src/auth/routes.ts";
import { signAccessToken, toRoleName } from "../src/auth/tokens.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type { Role, User } from "../src/generated/prisma/client.ts";

export const TEST_PASSWORD = "correct-horse-battery";

export async function resetDatabase() {
  if (!new URL(env.databaseUrl).pathname.endsWith("_test")) {
    throw new Error("Refusing to wipe a database whose name doesn't end in _test");
  }
  // CASCADE also empties every table that references these two.
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

// Returns the "refresh_token=..." pair from a response's Set-Cookie header,
// ready to send back in a Cookie header.
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

// A barber who works 09:00-18:00 every day of the week with a break at
// 13:00-14:00, so tests can use any date.
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

// The login of a barber made with createBarber().
export async function authHeaderForBarber(barber: { userId: string }): Promise<string> {
  return authHeaderFor(await prisma.user.findUniqueOrThrow({ where: { id: barber.userId } }));
}
