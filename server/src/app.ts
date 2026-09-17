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

// Builds the app without starting it, so tests can drive it directly.
// Tests pass their own stand-ins for whichever dependencies they want to
// watch; the rest are created as usual.
export function createApp(overrides: Partial<Dependencies> = {}): Express {
  const deps: Dependencies = { ...createDependencies(), ...overrides };
  const app = express();
  app.disable("x-powered-by");

  // Before express.json(): the payment webhook needs its body as the raw
  // bytes that were sent, and express.json() would consume them first.
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

  // Order matters: these two come after every route.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
