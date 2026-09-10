import type { Request, RequestHandler } from "express";
import { AppError } from "../errors.ts";
import { type AuthContext, type RoleName, verifyAccessToken } from "./tokens.ts";

// Adds `req.auth` to Express's Request type. It is set by requireAuth.
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

// Expects "Authorization: Bearer <access token>".
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

// Use after requireAuth: router.get("/x", requireAuth, requireRole("admin"), ...)
export function requireRole(...allowedRoles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = getAuth(req);
    if (!allowedRoles.includes(role)) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to do this");
    }
    next();
  };
}

// For handlers that run behind requireAuth and need to know who is calling.
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw unauthenticated();
  }
  return req.auth;
}
