import path from "node:path";
import { z } from "zod";
import { isValidTimeZone } from "./shop/time.ts";

// The .env file sits at the repo root so Docker Compose and the server
// read the same values. Variables that are already set are not overwritten.
process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));

// An optional setting left empty in .env counts as not set.
const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
  SHOP_TIME_ZONE: z
    .string()
    .refine(isValidTimeZone, "must be an IANA time zone name such as Asia/Tbilisi"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Where the website is served. Payment pages send the customer back here.
  APP_URL: z.url().default("http://localhost:5173"),
  // Both, or neither. Without them the fake payment provider is used.
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment variables. See .env.example.\n${z.prettifyError(parsed.error)}`,
  );
}

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = parsed.data;
if (Boolean(STRIPE_SECRET_KEY) !== Boolean(STRIPE_WEBHOOK_SECRET)) {
  throw new Error(
    "Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither. See .env.example.",
  );
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
  shopTimeZone: parsed.data.SHOP_TIME_ZONE,
  port: parsed.data.PORT,
  // No trailing slash, so paths can be appended.
  appUrl: parsed.data.APP_URL.replace(/\/$/, ""),
  // Undefined when Stripe isn't configured.
  stripe:
    STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET
      ? { secretKey: STRIPE_SECRET_KEY, webhookSecret: STRIPE_WEBHOOK_SECRET }
      : undefined,
  isProduction: parsed.data.NODE_ENV === "production",
};
