import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

// Runs once before all tests: creates the test database if it doesn't
// exist and applies any migrations it is missing.
export default function setup(project: TestProject) {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: project.config.env.DATABASE_URL },
    stdio: "pipe",
  });
}
