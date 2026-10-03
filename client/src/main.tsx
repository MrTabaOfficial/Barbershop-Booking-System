import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ApiError } from "./api/http.ts";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { LanguageProvider, useLanguage } from "./i18n/LanguageProvider.tsx";
import { router } from "./routes.tsx";

import "@fontsource/firago/400.css";
import "@fontsource/firago/600.css";

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

// Every page reads the language through t(), not through React, so a change
// of language remounts the whole router to re-render them.
function App() {
  const { language } = useLanguage();
  return <RouterProvider key={language} router={router} />;
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
