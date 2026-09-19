import { prisma } from "../db.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

// A revoked token is kept for a week because reuse detection can only
// recognise a stolen token while its row is still there.
export const REVOKED_TOKEN_RETENTION_DAYS = 7;

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
