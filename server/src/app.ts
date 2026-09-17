import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { createAdminRouter } from "./admin/routes.ts";
import { createAuthRouter } from "./auth/routes.ts";
import { createAvailabilityRouter } from "./availability/routes.ts";
import { createBarberRouter } from "./barber/routes.ts";
import { createBarbersRouter } from "./barbers/routes.ts";
import { createBookingsRouter } from "./bookings/routes.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";
import { createPaymentProvider } from "./payments/index.ts";
import type { PaymentProvider } from "./payments/provider.ts";
import { createPaymentsRouter } from "./payments/routes.ts";
import { createServicesRouter } from "./services/routes.ts";
import { createShopRouter } from "./shop/routes.ts";

type AppDependencies = {
  // Tests pass their own, to watch what it is asked to do.
  payments?: PaymentProvider;
};

// Builds the app without starting it, so tests can drive it directly.
export function createApp({
  payments = createPaymentProvider(),
}: AppDependencies = {}): Express {
  const app = express();
  app.disable("x-powered-by");

  // Before express.json(): the payment webhook needs its body as the raw
  // bytes that were sent, and express.json() would consume them first.
  app.use("/payments", createPaymentsRouter(payments));

  app.use(express.json());
  app.use(cookieParser());

  app.use("/auth", createAuthRouter());
  app.use("/shop", createShopRouter());
  app.use("/services", createServicesRouter());
  app.use("/barbers", createBarbersRouter());
  app.use("/availability", createAvailabilityRouter());
  app.use("/bookings", createBookingsRouter(payments));
  app.use("/barber", createBarberRouter());
  app.use("/admin", createAdminRouter(payments));

  // Order matters: these two come after every route.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
