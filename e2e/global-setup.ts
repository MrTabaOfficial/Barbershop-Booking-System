import { execSync } from "node:child_process";
import path from "node:path";
import { DATABASE_URL, repoRoot } from "./environment.ts";

// Runs once before the tests: creates the e2e database if it doesn't
// exist, applies migrations, and reloads the demo data, so every run starts
// from the same known state.
export default function setup() {
  const options = {
    cwd: path.join(repoRoot, "server"),
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  } as const;
  execSync("npx prisma migrate deploy", options);
  execSync("npx prisma db seed", options);
}
