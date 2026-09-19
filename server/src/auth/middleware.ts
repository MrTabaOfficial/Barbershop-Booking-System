import type { Request, RequestHandler } from "express";
import { AppError } from "../errors.ts";
import { type AuthContext, type RoleName, verifyAccessToken } from "./tokens.ts";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function unauthenticated(): AppError {
  return new AppError(401, "UNAUTHENTICATED", "A valid access token is required");
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.get("authorization")?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw unauthenticated();
  }

  const auth = await verifyAccessToken(token);
  if (!auth) {
    throw unauthenticated();
  }

  req.auth = auth;
  next();
};

// A bad or expired token is refused rather than treated as anonymous, so the
// client learns it has to refresh instead of silently losing the extra
// behaviour.
export const optionalAuth: RequestHandler = (req, res, next) => {
  if (req.get("authorization") === undefined) {
    next();
    return;
  }
  return requireAuth(req, res, next);
};

export function requireRole(...allowedRoles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = getAuth(req);
    if (!allowedRoles.includes(role)) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to do this");
    }
    next();
  };
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw unauthenticated();
  }
  return req.auth;
}
