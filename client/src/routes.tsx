import { createBrowserRouter } from "react-router";
import { AdminLayout } from "./admin/AdminLayout.tsx";
import { BookingsPage } from "./admin/BookingsPage.tsx";
import { OverviewPage } from "./admin/OverviewPage.tsx";
import { ServicesPage } from "./admin/ServicesPage.tsx";
import { StaffPage } from "./admin/StaffPage.tsx";
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
      {
        path: "admin",
        element: (
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <OverviewPage /> },
          { path: "bookings", element: <BookingsPage /> },
          { path: "services", element: <ServicesPage /> },
          { path: "staff", element: <StaffPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
