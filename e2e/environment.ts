import path from "node:path";

export const repoRoot = path.resolve(import.meta.dirname, "..");

process.loadEnvFile(path.join(repoRoot, ".env"));
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

const e2eDatabaseUrl = new URL(process.env.DATABASE_URL);
e2eDatabaseUrl.pathname += "_e2e";
export const DATABASE_URL = e2eDatabaseUrl.href;

export const API_PORT = 3100;
export const WEB_PORT = 5174;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

if (!process.env.SEED_PASSWORD) {
  throw new Error("SEED_PASSWORD is not set. See .env.example.");
}
export const SEED_PASSWORD = process.env.SEED_PASSWORD;
