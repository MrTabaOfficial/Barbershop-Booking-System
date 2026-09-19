import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const { PORT = "3000" } = loadEnv(mode, "..", "PORT");

  const apiProxy = {
    "/api": {
      target: `http://localhost:${PORT}`,
      rewrite: (path: string) => path.replace(/^\/api/, ""),
      // The API scopes the refresh cookie to /auth, which the browser sees as
      // /api/auth, so the path is rewritten or the cookie would never be sent
      // back.
      cookiePathRewrite: { "/auth": "/api/auth" },
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
    test: { include: ["src/**/*.test.ts"] },
  };
});
