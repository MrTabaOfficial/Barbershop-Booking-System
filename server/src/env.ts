import path from "node:path";
import { z } from "zod";

// The .env file sits at the repo root so Docker Compose and the server
// read the same values. Variables that are already set are not overwritten.
process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment variables. See .env.example.\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
  port: parsed.data.PORT,
  isProduction: parsed.data.NODE_ENV === "production",
};
