import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

// bcrypt ignores everything past 72 bytes, so longer passwords are refused
// at validation instead of being silently truncated.
export const MAX_PASSWORD_LENGTH = 72;

// Stands in for the stored hash when no account matches the email, so a
// login attempt takes the same time whether or not the account exists.
const unknownAccountHash = bcrypt.hashSync(randomBytes(16).toString("hex"), BCRYPT_COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | undefined,
): Promise<boolean> {
  const matches = await bcrypt.compare(password, passwordHash ?? unknownAccountHash);
  return passwordHash !== undefined && matches;
}
