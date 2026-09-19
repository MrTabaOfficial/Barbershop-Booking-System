import type { Session, User } from "./types.ts";

const API_PREFIX = "/api";

export type FieldIssue = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get fieldIssues(): FieldIssue[] {
    return Array.isArray(this.details) ? this.details.filter(isFieldIssue) : [];
  }
}

function isFieldIssue(value: unknown): value is FieldIssue {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

// The access token is kept in memory only, because anything written to
// localStorage can be read by any script on the page.
let accessToken: string | null = null;

type SessionListener = (user: User | null) => void;
let sessionListener: SessionListener | null = null;

export function onSessionChange(listener: SessionListener): () => void {
  sessionListener = listener;
  return () => {
    if (sessionListener === listener) {
      sessionListener = null;
    }
  };
}

const SESSION_HINT_KEY = "dalaki.hasSession";

export function mayHaveSession(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) !== null;
  } catch {
    // Storage can be unavailable (private mode, tests), and asking the server
    // anyway is always safe.
    return true;
  }
}

function rememberSessionHint(hasSession: boolean): void {
  try {
    if (hasSession) {
      localStorage.setItem(SESSION_HINT_KEY, "1");
    } else {
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Losing the hint only costs one extra request, so a storage failure is
    // ignored.
  }
}

export function setSession(session: Session | null): void {
  accessToken = session?.accessToken ?? null;
  rememberSessionHint(session !== null);
  sessionListener?.(session?.user ?? null);
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const { error } = await response.json();
    return new ApiError(response.status, error.code, error.message, error.details);
  } catch {
    return new ApiError(
      response.status,
      "UNEXPECTED_RESPONSE",
      "Something went wrong on our side. Please try again in a moment.",
    );
  }
}

async function exchangeRefreshCookie(): Promise<Session | null> {
  const response = await fetch(`${API_PREFIX}/auth/refresh`, { method: "POST" });
  if (response.status === 401) {
    setSession(null);
    return null;
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  const session = (await response.json()) as Session;
  setSession(session);
  return session;
}

let refreshInFlight: Promise<Session | null> | null = null;

// A refresh token works once and a second use ends every session, so
// refreshes must never overlap: one shared request within a tab, and a
// browser lock between tabs.
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= (
    navigator.locks
      ? navigator.locks.request("dalaki-session-refresh", exchangeRefreshCookie)
      : exchangeRefreshCookie()
  ).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return fetch(API_PREFIX + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function request(path: string, options: RequestOptions): Promise<Response> {
  let response: Response;
  try {
    response = await send(path, options);

    // The /auth endpoints are left alone because their 401s mean a wrong
    // password, which a refresh can't fix.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      await refreshSession();
      // The retry goes ahead even if the session turned out to have ended, so
      // that public endpoints still answer without a token.
      response = await send(path, options);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We couldn't reach the server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const response = await request(path, {});
  const fileName =
    /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ??
    fallbackName;

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}
