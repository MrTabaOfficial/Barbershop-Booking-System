import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, mayHaveSession, onSessionChange, setSession } from "./http.ts";
import type { User } from "./types.ts";

const user: User = {
  id: "user-1",
  email: "davit@dalaki.example",
  name: "Davit Maisuradze",
  phone: null,
  role: "customer",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const unauthenticated = () =>
  json(401, { error: { code: "UNAUTHENTICATED", message: "A valid access token is required" } });

type Call = { url: string; method: string; authorization: string | undefined };
let calls: Call[];

function fakeApi(respond: (call: Call) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const call = { url, method: init.method ?? "GET", authorization: headers.Authorization };
    calls.push(call);
    return respond(call);
  });
}

function apiThatAcceptsOnlyTheFreshToken() {
  fakeApi((call) => {
    if (call.url === "/api/auth/refresh") {
      return json(200, { accessToken: "fresh", user });
    }
    return call.authorization === "Bearer fresh" ? json(200, { ok: true }) : unauthenticated();
  });
}

const refreshCalls = () => calls.filter((call) => call.url === "/api/auth/refresh");

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

beforeEach(() => {
  calls = [];
  setSession(null);
});

describe("the session hint", () => {
  it("is set while there is a session and cleared when it ends", () => {
    expect(mayHaveSession()).toBe(false);

    setSession({ accessToken: "current", user });
    expect(mayHaveSession()).toBe(true);

    setSession(null);
    expect(mayHaveSession()).toBe(false);
  });

  it("never holds the access token", () => {
    setSession({ accessToken: "secret-token", user });

    expect([...storage.values()].join(" ")).not.toContain("secret-token");
  });
});

describe("apiRequest", () => {
  it("sends the access token once there is a session", async () => {
    fakeApi(() => json(200, { ok: true }));
    setSession({ accessToken: "current", user });

    await apiRequest("/bookings/mine");

    expect(calls).toEqual([
      { url: "/api/bookings/mine", method: "GET", authorization: "Bearer current" },
    ]);
  });

  it("refreshes once after a 401 and retries with the new token", async () => {
    apiThatAcceptsOnlyTheFreshToken();
    setSession({ accessToken: "expired", user });

    const result = await apiRequest("/bookings/mine");

    expect(result).toEqual({ ok: true });
    expect(calls.map((call) => `${call.method} ${call.url} ${call.authorization ?? "-"}`)).toEqual([
      "GET /api/bookings/mine Bearer expired",
      "POST /api/auth/refresh -",
      "GET /api/bookings/mine Bearer fresh",
    ]);
  });

  it("shares one refresh between requests that fail at the same time", async () => {
    apiThatAcceptsOnlyTheFreshToken();
    setSession({ accessToken: "expired", user });

    const results = await Promise.all([
      apiRequest("/bookings/mine"),
      apiRequest("/bookings/mine"),
      apiRequest("/bookings/mine"),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("ends the session when the refresh is refused, and reports the 401", async () => {
    fakeApi(() => unauthenticated());
    setSession({ accessToken: "expired", user });
    const sessionChanges: (User | null)[] = [];
    onSessionChange((changedUser) => sessionChanges.push(changedUser));

    await expect(apiRequest("/bookings/mine")).rejects.toMatchObject({ status: 401 });

    expect(sessionChanges).toEqual([null]);
    expect(calls.map((call) => `${call.url} ${call.authorization ?? "-"}`)).toEqual([
      "/api/bookings/mine Bearer expired",
      "/api/auth/refresh -",
      "/api/bookings/mine -",
    ]);
  });

  it("still gets an answer from a public endpoint after the session has ended", async () => {
    fakeApi((call) => {
      if (call.url === "/api/auth/refresh") {
        return unauthenticated();
      }
      return call.authorization ? unauthenticated() : json(200, { slots: [] });
    });
    setSession({ accessToken: "expired", user });

    await expect(apiRequest("/availability")).resolves.toEqual({ slots: [] });
  });

  it("retries only once, even if the retry is also refused", async () => {
    fakeApi((call) =>
      call.url === "/api/auth/refresh"
        ? json(200, { accessToken: "fresh", user })
        : unauthenticated(),
    );

    await expect(apiRequest("/bookings/mine")).rejects.toMatchObject({ status: 401 });

    expect(calls).toHaveLength(3);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("does not try to refresh when a login is rejected", async () => {
    fakeApi(() =>
      json(401, { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }),
    );

    await expect(
      apiRequest("/auth/login", { method: "POST", body: { email: "a@b.ge", password: "x" } }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(calls).toHaveLength(1);
  });

  it("turns the API's error format into an ApiError with field issues", async () => {
    fakeApi(() =>
      json(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is not valid",
          details: [{ path: "email", message: "Invalid email address" }],
        },
      }),
    );

    const error = await apiRequest("/auth/register", { method: "POST", body: {} }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      fieldIssues: [{ path: "email", message: "Invalid email address" }],
    });
  });

  it("reports a network failure as an ApiError too", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(apiRequest("/services")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("copes with an error response that is not JSON", async () => {
    fakeApi(() => new Response("Bad gateway", { status: 502 }));

    await expect(apiRequest("/services")).rejects.toMatchObject({
      status: 502,
      code: "UNEXPECTED_RESPONSE",
    });
  });
});
