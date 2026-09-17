import { Prisma } from "../generated/prisma/client.ts";

// True when PostgreSQL refused a write because another booking for that
// barber covers the time. It reports this in one of two ways:
// - a violation of the bookings_no_overlap exclusion constraint, when the
//   other booking was already saved;
// - a deadlock (Prisma code P2034), when both were being saved at the same
//   instant. Each write waits to see if the other commits, and PostgreSQL
//   breaks the tie by aborting one of them. The other one goes through.
export function isSlotTakenError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  return error.code === "P2034" || error.message.includes("bookings_no_overlap");
}
