import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./http.ts";
import type {
  AdminBarber,
  AdminBooking,
  AdminBookingPage,
  AdminService,
  Overview,
  WorkingDay,
} from "./types.ts";

// Everything the admin pages read sits under the ["admin"] key.

// After the admin changes something, both their own lists and the public
// ones the website shows (services, barbers, free times) are out of date.
function useRefreshEverything() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries();
}

// --- services

export function useAdminServices() {
  return useQuery({
    queryKey: ["admin", "services"],
    queryFn: async () =>
      (await apiRequest<{ services: AdminService[] }>("/admin/services")).services,
  });
}

export type ServiceInput = {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
};

// Creates a service, or updates the one with the given id.
export function useSaveService() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ServiceInput> & { id?: string; isActive?: boolean }) =>
      apiRequest<{ service: AdminService }>(id ? `/admin/services/${id}` : "/admin/services", {
        method: id ? "PATCH" : "POST",
        body: input,
      }),
    onSuccess: refresh,
  });
}

// --- barbers

export function useAdminBarbers() {
  return useQuery({
    queryKey: ["admin", "barbers"],
    queryFn: async () => (await apiRequest<{ barbers: AdminBarber[] }>("/admin/barbers")).barbers,
  });
}

export function useCreateBarber() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; bio: string | null }) =>
      apiRequest<{ barber: AdminBarber }>("/admin/barbers", { method: "POST", body: input }),
    onSuccess: refresh,
  });
}

export function useUpdateBarber() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      bio?: string | null;
      isActive?: boolean;
    }) => apiRequest<{ barber: AdminBarber }>(`/admin/barbers/${id}`, { method: "PATCH", body: input }),
    onSuccess: refresh,
  });
}

export function useSaveWorkingHours() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: (input: { barberId: string; days: WorkingDay[] }) =>
      apiRequest<{ barber: AdminBarber }>(`/admin/barbers/${input.barberId}/working-hours`, {
        method: "PUT",
        body: { days: input.days },
      }),
    onSuccess: refresh,
  });
}

// --- bookings

// `query` is the filters, sorting and page as a query string, straight
// from the page's URL.
export function useAdminBookings(query: string) {
  return useQuery({
    queryKey: ["admin", "bookings", query],
    queryFn: () => apiRequest<AdminBookingPage>(`/admin/bookings?${query}`),
    // While the next page or filter loads, keep showing the current rows
    // instead of flashing an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useCancelBookingAsAdmin() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: (input: { bookingId: string; refund: boolean }) =>
      apiRequest<{ booking: AdminBooking }>(`/admin/bookings/${input.bookingId}/cancel`, {
        method: "POST",
        body: { refund: input.refund },
      }),
    onSettled: refresh,
  });
}

// --- overview

export function useOverview(from: string, to: string) {
  return useQuery({
    queryKey: ["admin", "overview", from, to],
    queryFn: () => apiRequest<Overview>(`/admin/overview?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  });
}
