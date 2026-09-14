import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./auth/RequireAuth.tsx";
import { Layout } from "./components/Layout.tsx";
import { LoginPage, RegisterPage } from "./pages/AuthPages.tsx";
import { BarberPage } from "./pages/BarberPage.tsx";
import { BookPage } from "./pages/BookPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { MyBookingsPage } from "./pages/MyBookingsPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";

// Every page renders inside Layout (header, footer). These are the
// browser's addresses; the API lives separately under /api.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "book", element: <BookPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "bookings",
        element: (
          <RequireAuth>
            <MyBookingsPage />
          </RequireAuth>
        ),
      },
      {
        path: "barber",
        element: (
          <RequireAuth role="barber">
            <BarberPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
