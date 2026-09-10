import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { createAuthRouter } from "./auth/routes.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";

// Builds the app without starting it, so tests can drive it directly.
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json());
  app.use(cookieParser());

  app.use("/auth", createAuthRouter());

  // Order matters: these two come after every route.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
