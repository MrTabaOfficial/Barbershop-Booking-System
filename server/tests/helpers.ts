import type { Response } from "supertest";
import { hashPassword } from "../src/auth/password.ts";
import { REFRESH_COOKIE } from "../src/auth/routes.ts";
import { prisma } from "../src/db.ts";
import { env } from "../src/env.ts";
import type { Role } from "../src/generated/prisma/client.ts";

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
