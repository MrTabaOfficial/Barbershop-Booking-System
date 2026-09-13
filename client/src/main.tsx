import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ApiError } from "./api/http.ts";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { router } from "./routes.tsx";

// The fonts are installed as packages and served by this app, so the page
// makes no requests to a font service and works offline.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-serif-georgian";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry once when the server or network failed. A 4xx answer is the
      // server saying no; asking again won't change it.
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
