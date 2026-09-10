import { type Request, type Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../env.ts";
import { AppError } from "../errors.ts";
import type { User } from "../generated/prisma/client.ts";
import { getAuth, requireAuth } from "./middleware.ts";
import { loginSchema, registerSchema } from "./schemas.ts";
import {
  findUserById,
  issueRefreshToken,
  registerCustomer,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyCredentials,
} from "./service.ts";
import { REFRESH_TOKEN_TTL_MS, signAccessToken, toRoleName } from "./tokens.ts";

export const REFRESH_COOKIE = "refresh_token";
export const LOGIN_MAX_FAILED_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// httpOnly keeps the token away from page scripts, sameSite stops other
// sites from sending it, and the path limits it to the auth endpoints.
const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: env.isProduction,
  path: "/auth",
} as const;

// The user as the API returns it: never the password hash.
function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: toRoleName(user.role),
  };
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies[REFRESH_COOKIE];
  return typeof value === "string" && value !== "" ? value : undefined;
}

async function sendSession(res: Response, status: number, user: User, refreshToken: string) {
  const accessToken = await signAccessToken({
    userId: user.id,
    role: toRoleName(user.role),
  });
  res
    .status(status)
    .cookie(REFRESH_COOKIE, refreshToken, {
      ...refreshCookieOptions,
      maxAge: REFRESH_TOKEN_TTL_MS,
    })
    .json({ accessToken, user: toPublicUser(user) });
}

// Express 5 passes errors thrown in async handlers to the error handler,
// so the routes below need no try/catch.
export function createAuthRouter(): Router {
  const router = Router();

  // Built per router so each app instance (each test) counts separately.
  const loginRateLimit = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_MAX_FAILED_ATTEMPTS,
    // Only failed logins count, so normal use never hits the limit.
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          "TOO_MANY_REQUESTS",
          "Too many failed login attempts. Try again later.",
        ),
      );
    },
  });

  router.post("/register", async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await registerCustomer(input);
    await sendSession(res, 201, user, await issueRefreshToken(user.id));
  });

  router.post("/login", loginRateLimit, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await verifyCredentials(input);
    await sendSession(res, 200, user, await issueRefreshToken(user.id));
  });

  router.post("/refresh", async (req, res) => {
    const currentToken = readRefreshCookie(req);
    if (!currentToken) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Please log in again");
    }
    const { user, refreshToken } = await rotateRefreshToken(currentToken);
    await sendSession(res, 200, user, refreshToken);
  });

  router.post("/logout", async (req, res) => {
    const currentToken = readRefreshCookie(req);
    if (currentToken) {
      await revokeRefreshToken(currentToken);
    }
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions).status(204).end();
  });

  router.get("/me", requireAuth, async (req, res) => {
    const user = await findUserById(getAuth(req).userId);
    if (!user) {
      // The token is valid but the account has since been deleted.
      throw new AppError(401, "UNAUTHENTICATED", "A valid access token is required");
    }
    res.json({ user: toPublicUser(user) });
  });

  return router;
}
