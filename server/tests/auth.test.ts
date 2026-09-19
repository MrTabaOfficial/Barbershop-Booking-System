import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { LOGIN_MAX_FAILED_ATTEMPTS } from "../src/auth/routes.ts";
import { prisma } from "../src/db.ts";
import { createUser, refreshCookieFrom, resetDatabase, TEST_PASSWORD } from "./helpers.ts";

const EMAIL = "alex@example.test";

let app: Express;

beforeEach(async () => {
  await resetDatabase();
  app = createApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function login(email = EMAIL, password = TEST_PASSWORD) {
  return request(app).post("/auth/login").send({ email, password });
}

function refresh(cookie: string) {
  return request(app).post("/auth/refresh").set("Cookie", cookie);
}

describe("POST /auth/register", () => {
  it("creates a customer and starts a session", async () => {
    const response = await request(app).post("/auth/register").send({
      email: "  New.Customer@Example.Test ",
      password: TEST_PASSWORD,
      name: "New Customer",
      role: "admin",
    });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toEqual({
      id: expect.any(String),
      email: "new.customer@example.test",
      name: "New Customer",
      phone: null,
      role: "customer",
    });
    expect(response.get("Set-Cookie")?.[0]).toMatch(/^refresh_token=.+HttpOnly/);
  });

  it("rejects invalid input in the standard error format", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    const invalidPaths = response.body.error.details.map(
      (detail: { path: string }) => detail.path,
    );
    expect(invalidPaths.sort()).toEqual(["email", "name", "password"]);
  });

  it("refuses an email that is already registered", async () => {
    await createUser(EMAIL);

    const response = await request(app)
      .post("/auth/register")
      .send({ email: EMAIL, password: TEST_PASSWORD, name: "Someone Else" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /auth/login", () => {
  it("returns an access token, the user, and a refresh cookie", async () => {
    const user = await createUser(EMAIL, "BARBER");

    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ id: user.id, email: EMAIL, role: "barber" });
    expect(response.body.user).not.toHaveProperty("passwordHash");

    const setCookie = response.get("Set-Cookie")?.[0];
    expect(setCookie).toMatch(/^refresh_token=/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/auth");
  });

  it("rejects a wrong password", async () => {
    await createUser(EMAIL);

    const response = await login(EMAIL, "wrong-password");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.get("Set-Cookie")).toBeUndefined();
  });

  it("answers an unknown email exactly like a wrong password", async () => {
    await createUser(EMAIL);

    const wrongPassword = await login(EMAIL, "wrong-password");
    const unknownEmail = await login("nobody@example.test", TEST_PASSWORD);

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("blocks further attempts after too many failures", async () => {
    await createUser(EMAIL);

    for (let attempt = 0; attempt < LOGIN_MAX_FAILED_ATTEMPTS; attempt++) {
      expect((await login(EMAIL, "wrong-password")).status).toBe(401);
    }
    const blocked = await login();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("POST /auth/refresh", () => {
  it("exchanges the refresh token for a new session", async () => {
    await createUser(EMAIL);
    const firstCookie = refreshCookieFrom(await login());

    const response = await refresh(firstCookie);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(EMAIL);
    expect(refreshCookieFrom(response)).not.toBe(firstCookie);
  });

  it("rejects an expired refresh token", async () => {
    await createUser(EMAIL);
    const cookie = refreshCookieFrom(await login());
    await prisma.refreshToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await refresh(cookie);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects a reused refresh token and ends the user's other sessions", async () => {
    await createUser(EMAIL);
    const firstCookie = refreshCookieFrom(await login());
    const secondCookie = refreshCookieFrom(await refresh(firstCookie));

    const reuse = await refresh(firstCookie);

    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    expect((await refresh(secondCookie)).status).toBe(401);
  });

  it("rejects a request without a refresh cookie", async () => {
    const response = await request(app).post("/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects a token it never issued", async () => {
    const response = await refresh("refresh_token=made-up-value");

    expect(response.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the refresh token and clears the cookie", async () => {
    await createUser(EMAIL);
    const cookie = refreshCookieFrom(await login());

    const response = await request(app).post("/auth/logout").set("Cookie", cookie);

    expect(response.status).toBe(204);
    expect(response.get("Set-Cookie")?.[0]).toMatch(/^refresh_token=;/);
    expect((await refresh(cookie)).status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns the user the access token belongs to", async () => {
    const user = await createUser(EMAIL);
    const { accessToken } = (await login()).body;

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: user.id, role: "customer" });
  });

  it("requires an access token", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("requests the API can't serve", () => {
  it("answers an unknown route in the standard error format", async () => {
    const response = await request(app).get("/no-such-route");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("answers malformed JSON in the standard error format", async () => {
    const response = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });
});
