import path from "node:path";
import { z } from "zod";
import { isValidTimeZone } from "./shop/time.ts";

process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));

// An optional setting left empty in .env counts as not set, so .env.example
// can list every variable.
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
  APP_URL: z.url().default("http://localhost:5173"),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  MAIL_FROM: z.string().min(3).default("Dalaki <bookings@dalaki.example>"),
  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_OWNER_CHAT_ID: optional,
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

const { TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID, SMTP_HOST } = parsed.data;
if (Boolean(TELEGRAM_BOT_TOKEN) !== Boolean(TELEGRAM_OWNER_CHAT_ID)) {
  throw new Error(
    "Set both TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID, or neither. See .env.example.",
  );
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
  shopTimeZone: parsed.data.SHOP_TIME_ZONE,
  port: parsed.data.PORT,
  appUrl: parsed.data.APP_URL.replace(/\/$/, ""),
  stripe:
    STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET
      ? { secretKey: STRIPE_SECRET_KEY, webhookSecret: STRIPE_WEBHOOK_SECRET }
      : undefined,
  smtp: SMTP_HOST ? { host: SMTP_HOST, port: parsed.data.SMTP_PORT } : undefined,
  mailFrom: parsed.data.MAIL_FROM,
  telegram:
    TELEGRAM_BOT_TOKEN && TELEGRAM_OWNER_CHAT_ID
      ? { botToken: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_OWNER_CHAT_ID }
      : undefined,
  isProduction: parsed.data.NODE_ENV === "production",
};
