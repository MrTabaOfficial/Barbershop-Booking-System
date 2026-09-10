import path from "node:path";

// The .env file sits at the repo root so Docker Compose and the server
// read the same values.
process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
};
