import { isUniqueViolation, prisma } from "../db.ts";
import { AppError } from "../errors.ts";
import type { User } from "../generated/prisma/client.ts";
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
    if (isUniqueViolation(error)) {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
    throw error;
  }
}

export async function verifyCredentials(input: LoginInput): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !passwordMatches) {
    // One message for both cases, so the response doesn't reveal which emails
    // have accounts.
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
    // A revoked token being presented means a copy may have been stolen, and
    // since there is no telling whether the thief or the owner used it first,
    // every session of this user ends.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw invalidRefreshToken();
  }

  if (stored.expiresAt <= new Date()) {
    throw invalidRefreshToken();
  }

  // The `revokedAt: null` condition lets only one of two simultaneous
  // requests with the same token update the row; the other gets a count of 0.
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
