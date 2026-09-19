import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}`);
};

function isClientError(error: unknown): error is { status: number; type?: string } {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return false;
  }
  return typeof error.status === "number" && error.status >= 400 && error.status < 500;
}

// Express recognises an error handler by its four parameters, so `_next` has
// to stay even though it is unused.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is not valid",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (isClientError(error)) {
    const message =
      error.type === "entity.parse.failed"
        ? "The request body is not valid JSON"
        : "The request could not be processed";
    res.status(error.status).json({ error: { code: "BAD_REQUEST", message } });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
};
