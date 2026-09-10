import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.ts";
import { PrismaClient } from "./generated/prisma/client.ts";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.databaseUrl,
    // The adapter sends and reads dates as UTC clock time without an offset,
    // which Postgres interprets in the session time zone. Pin it to UTC so
    // timestamps stay correct whatever the database's default zone is.
    options: "-c TimeZone=UTC",
  }),
});
