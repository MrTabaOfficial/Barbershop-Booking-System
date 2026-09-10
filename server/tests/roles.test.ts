import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireAuth, requireRole } from "../src/auth/middleware.ts";
import { type RoleName, signAccessToken } from "../src/auth/tokens.ts";
import { env } from "../src/env.ts";
import { errorHandler } from "../src/errors.ts";

// No real route is role-protected yet, so the middleware is tested on a
// small app with two protected routes.
const app = express();
app.get("/admin-only", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({ ok: true });
});
app.get("/staff-only", requireAuth, requireRole("admin", "barber"), (_req, res) => {
  res.json({ ok: true });
});
app.use(errorHandler);

async function getAs(path: string, role: RoleName) {
  const accessToken = await signAccessToken({ userId: "user-1", role });
  return request(app).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("requireRole", () => {
  it("refuses a customer on an admin route", async () => {
    const response = await getAs("/admin-only", "customer");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("refuses a barber on an admin route", async () => {
    expect((await getAs("/admin-only", "barber")).status).toBe(403);
  });

  it("lets an admin through", async () => {
    const response = await getAs("/admin-only", "admin");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("accepts any of several allowed roles", async () => {
    expect((await getAs("/staff-only", "barber")).status).toBe(200);
    expect((await getAs("/staff-only", "admin")).status).toBe(200);
    expect((await getAs("/staff-only", "customer")).status).toBe(403);
  });
});

describe("requireAuth", () => {
  it("rejects a request without a token", async () => {
    const response = await request(app).get("/admin-only");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an expired access token", async () => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const expiredToken = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime(oneHourAgo)
      .sign(new TextEncoder().encode(env.jwtAccessSecret));

    const response = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it("rejects a token signed with a different secret", async () => {
    const forgedToken = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("not-the-real-secret-not-the-real-secret"));

    const response = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${forgedToken}`);

    expect(response.status).toBe(401);
  });
});
