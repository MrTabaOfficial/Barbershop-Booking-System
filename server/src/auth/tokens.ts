import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../env.ts";
import type { Role } from "../generated/prisma/client.ts";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The database stores roles in upper case (CUSTOMER); the API speaks lower
// case (customer). This is the one place that converts.
export type RoleName = Lowercase<Role>;

export function toRoleName(role: Role): RoleName {
  return role.toLowerCase() as RoleName;
}

// Who is making a request, as proven by their access token.
export type AuthContext = {
  userId: string;
  role: RoleName;
};

const accessSecret = new TextEncoder().encode(env.jwtAccessSecret);

const accessClaimsSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["customer", "barber", "admin"]),
});

export function signAccessToken(auth: AuthContext): Promise<string> {
  return new SignJWT({ role: auth.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(auth.userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: ["HS256"] });
    const claims = accessClaimsSchema.parse(payload);
    return { userId: claims.sub, role: claims.role };
  } catch {
    return null;
  }
}

// A refresh token is random bytes, not a JWT: it means nothing by itself
// and is only valid while its hash is in the refresh_tokens table.
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

// A fast hash is enough here. Unlike a password, the token is too random
// to guess, and a plain SHA-256 can be looked up through a unique index.
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
