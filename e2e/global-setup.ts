import { execSync } from "node:child_process";
import path from "node:path";
import { DATABASE_URL, repoRoot } from "./environment.ts";

export default function setup() {
  const options = {
    cwd: path.join(repoRoot, "server"),
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  } as const;
  execSync("npx prisma migrate deploy", options);
  execSync("npx prisma db seed", options);
}
