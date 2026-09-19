import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.ts";
import { Prisma, PrismaClient } from "./generated/prisma/client.ts";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.databaseUrl,
    // The adapter sends and reads dates as UTC clock time without an offset,
    // which Postgres interprets in the session time zone, so the session is
    // pinned to UTC.
    options: "-c TimeZone=UTC",
  }),
});

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
