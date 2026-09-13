import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // The API's port comes from the same .env at the repo root that the
  // server reads. npm runs this from /client, so the root is one level up.
  const { PORT = "3000" } = loadEnv(mode, "..", "PORT");

  // The browser only ever talks to this dev server. Requests to /api/* are
  // forwarded to the API with the prefix removed, which keeps everything
  // on one origin: no CORS, and the refresh cookie is a same-site cookie.
  const apiProxy = {
    "/api": {
      target: `http://localhost:${PORT}`,
      rewrite: (path: string) => path.replace(/^\/api/, ""),
      // The API scopes the refresh cookie to /auth. The browser sees that
      // endpoint as /api/auth, so the cookie's path has to be rewritten or
      // the browser would never send it back.
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
