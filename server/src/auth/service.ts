import { prisma } from "../db.ts";
import { AppError } from "../errors.ts";
import { Prisma, type User } from "../generated/prisma/client.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import type { LoginInput, RegisterInput } from "./schemas.ts";
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "./tokens.ts";

function invalidRefreshToken(): AppError {
  return new AppError(401, "INVALID_REFRESH_TOKEN", "Please log in again");
}

export async function registerCustomer(input: RegisterInput): Promise<User> {
  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        role: "CUSTOMER",
      },
    });
  } catch (error) {
    // P2002 is Prisma's code for a unique constraint violation. Letting the
    // database decide avoids a check-then-insert race between two requests.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
    throw error;
  }
}

export async function verifyCredentials(input: LoginInput): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !passwordMatches) {
    // One message for both cases, so the response doesn't reveal which
    // emails have accounts.
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return user;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return refreshToken;
}

// Exchanges a refresh token for a new one. Each token works exactly once.
export async function rotateRefreshToken(
  refreshToken: string,
): Promise<{ user: User; refreshToken: string }> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: true },
  });
  if (!stored) {
    throw invalidRefreshToken();
  }

  if (stored.revokedAt) {
    // This token was already used or logged out, yet someone still holds a
    // copy. It may have been stolen, and there is no telling whether the
    // thief or the owner used it first, so every session of this user ends.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw invalidRefreshToken();
  }

  if (stored.expiresAt <= new Date()) {
    throw invalidRefreshToken();
  }

  // The `revokedAt: null` condition makes this safe when two requests
  // arrive with the same token at once: the database lets only one of them
  // update the row, and the other gets a count of 0.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw invalidRefreshToken();
  }

  return {
    user: stored.user,
    refreshToken: await issueRefreshToken(stored.userId),
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}
