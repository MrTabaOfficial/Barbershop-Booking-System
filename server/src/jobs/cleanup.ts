import { prisma } from "../db.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

// A revoked token is kept this long before it is deleted. It has to be
// kept for a while: when someone presents a revoked token, the login code
// recognises a possible theft and ends all of that user's sessions, and it
// can only recognise the token if the row is still there. A stolen token
// is most likely to be replayed soon, so a week covers the risk without
// the table growing for ever.
export const REVOKED_TOKEN_RETENTION_DAYS = 7;

// Deletes refresh tokens that can no longer do anything: the expired ones,
// and the ones revoked more than a week ago. Returns how many went.
export async function deleteDeadRefreshTokens(now = new Date()): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - REVOKED_TOKEN_RETENTION_DAYS * DAY_MS) } },
      ],
    },
  });
  return result.count;
}
