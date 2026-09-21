import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ApiError } from "./api/http.ts";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { router } from "./routes.tsx";

import "@fontsource/firago/400.css";
import "@fontsource/firago/600.css";
import "@fontsource/firago/800.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
        return !isClientError && failureCount < 1;
      },
    },
  },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
