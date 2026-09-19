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

function useRefreshEverything() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries();
}

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

export function useAdminBookings(query: string) {
  return useQuery({
    queryKey: ["admin", "bookings", query],
    queryFn: () => apiRequest<AdminBookingPage>(`/admin/bookings?${query}`),
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

export function useOverview(from: string, to: string) {
  return useQuery({
    queryKey: ["admin", "overview", from, to],
    queryFn: () => apiRequest<Overview>(`/admin/overview?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  });
}
