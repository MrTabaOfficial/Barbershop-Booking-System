import { z } from "zod";
import { MAX_PASSWORD_LENGTH } from "./password.ts";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// Unknown keys are dropped, so a "role" sent by the client never reaches
// the database.
export const registerSchema = z.object({
  email,
  password: z.string().min(8).max(MAX_PASSWORD_LENGTH),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
