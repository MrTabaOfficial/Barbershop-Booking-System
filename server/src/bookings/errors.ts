import { Prisma } from "../generated/prisma/client.ts";

// PostgreSQL reports a clash either as a violation of bookings_no_overlap or,
// when both writes arrive at the same instant, as a deadlock (P2034) in which
// it aborts one of them, so both mean the slot is taken.
export function isSlotTakenError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  return error.code === "P2034" || error.message.includes("bookings_no_overlap");
}
