import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { createAdminRouter } from "./admin/routes.ts";
import { createAuthRouter } from "./auth/routes.ts";
import { createAvailabilityRouter } from "./availability/routes.ts";
import { createBarberRouter } from "./barber/routes.ts";
import { createBarbersRouter } from "./barbers/routes.ts";
import { createBookingsRouter } from "./bookings/routes.ts";
import { createDependencies, type Dependencies } from "./dependencies.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";
import { createPaymentsRouter } from "./payments/routes.ts";
import { createServicesRouter } from "./services/routes.ts";
import { createShopRouter } from "./shop/routes.ts";

export function createApp(overrides: Partial<Dependencies> = {}): Express {
  const deps: Dependencies = { ...createDependencies(), ...overrides };
  const app = express();
  app.disable("x-powered-by");

  // The payment routes come before express.json() because the webhook needs
  // its body as the raw bytes that were sent, which express.json() would
  // consume.
  app.use("/payments", createPaymentsRouter(deps));

  app.use(express.json());
  app.use(cookieParser());

  app.use("/auth", createAuthRouter());
  app.use("/shop", createShopRouter());
  app.use("/services", createServicesRouter());
  app.use("/barbers", createBarbersRouter());
  app.use("/availability", createAvailabilityRouter());
  app.use("/bookings", createBookingsRouter(deps));
  app.use("/barber", createBarberRouter());
  app.use("/admin", createAdminRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
