import type { Session, User } from "./types.ts";

const API_PREFIX = "/api";

export type FieldIssue = { path: string; message: string };

// Every failed request becomes one of these, built from the API's error
// format: { error: { code, message, details } }.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  // Whatever extra the API attached. Its shape depends on the code.
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // Per-field validation messages, when that is what the details are.
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

// The access token lives only in this variable. It is never written to
// localStorage or a cookie, so a reload or a closed tab forgets it, and the
// session is then restored from the httpOnly refresh cookie.
let accessToken: string | null = null;

type SessionListener = (user: User | null) => void;
let sessionListener: SessionListener | null = null;

// Lets the auth provider hear about every change, including the ones that
// happen here when a refresh succeeds or fails in the middle of a request.
export function onSessionChange(listener: SessionListener): () => void {
  sessionListener = listener;
  return () => {
    if (sessionListener === listener) {
      sessionListener = null;
    }
  };
}

// Not a credential: it only records that this browser has logged in at
// some point. Without it, every page load by an anonymous visitor would
// ask for a session refresh that is bound to fail.
const SESSION_HINT_KEY = "dalaki.hasSession";

export function mayHaveSession(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) !== null;
  } catch {
    // Storage can be unavailable (private mode, tests). Asking the server
    // is always safe.
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
    // The hint is only an optimisation.
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
    // Not the API's error format, e.g. the proxy answering because the API is down.
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

// Trades the refresh cookie for a new access token. Resolves to null when
// there is no valid session.
//
// A refresh token works once, and the server treats a second use as theft
// and ends every session. So refreshes must never overlap:
// - within this tab, every caller shares one request while it is running;
// - across tabs, a browser lock makes them take turns, so each tab sends
//   the cookie the previous one just received.
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

// Sends a request and returns the successful response. Everything about
// tokens, refreshing and errors happens here, whatever the caller then
// does with the body.
async function request(path: string, options: RequestOptions): Promise<Response> {
  let response: Response;
  try {
    response = await send(path, options);

    // A 401 usually means the access token expired: refresh once and
    // retry once. The /auth endpoints are left alone because their 401s
    // mean something else (a wrong password) that a refresh can't fix.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      await refreshSession();
      // Retry even if the session turned out to have ended. The request
      // then goes without a token: public endpoints still answer, and
      // protected ones return a 401 that is reported below.
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

// Fetches a file and hands it to the browser to save. A plain link can't
// be used for this, because a link can't send the access token.
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

// The message to show a person for any failure.
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}
