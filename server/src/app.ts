import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { createAuthRouter } from "./auth/routes.ts";
import { createAvailabilityRouter } from "./availability/routes.ts";
import { createBarberRouter } from "./barber/routes.ts";
import { createBarbersRouter } from "./barbers/routes.ts";
import { createBookingsRouter } from "./bookings/routes.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";
import { createServicesRouter } from "./services/routes.ts";
import { createShopRouter } from "./shop/routes.ts";

// Builds the app without starting it, so tests can drive it directly.
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json());
  app.use(cookieParser());

  app.use("/auth", createAuthRouter());
  app.use("/shop", createShopRouter());
  app.use("/services", createServicesRouter());
  app.use("/barbers", createBarbersRouter());
  app.use("/availability", createAvailabilityRouter());
  app.use("/bookings", createBookingsRouter());
  app.use("/barber", createBarberRouter());

  // Order matters: these two come after every route.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
