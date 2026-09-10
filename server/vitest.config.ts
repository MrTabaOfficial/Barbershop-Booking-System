import path from "node:path";
import { defineConfig } from "vitest/config";

process.loadEnvFile(path.resolve(import.meta.dirname, "../.env"));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

// Tests wipe tables, so they get their own database on the same server:
// the development database's name with _test appended.
const testDatabaseUrl = new URL(process.env.DATABASE_URL);
testDatabaseUrl.pathname += "_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: testDatabaseUrl.href },
    globalSetup: "tests/global-setup.ts",
    // Every test file uses the same database, so files run one at a time.
    fileParallelism: false,
  },
});
