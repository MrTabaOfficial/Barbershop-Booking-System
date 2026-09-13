import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./http.ts";
import type {
  Availability,
  Barber,
  Booking,
  MyBookings,
  Service,
  Shop,
} from "./types.ts";

const FIVE_MINUTES = 5 * 60 * 1000;

// Rarely changes, so it isn't refetched on every visit to a page.
export function useShop() {
  return useQuery({
    queryKey: ["shop"],
    queryFn: () => apiRequest<Shop>("/shop"),
    staleTime: FIVE_MINUTES,
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => (await apiRequest<{ services: Service[] }>("/services")).services,
    staleTime: FIVE_MINUTES,
  });
}

export function useBarbers() {
  return useQuery({
    queryKey: ["barbers"],
    queryFn: async () => (await apiRequest<{ barbers: Barber[] }>("/barbers")).barbers,
    staleTime: FIVE_MINUTES,
  });
}

type AvailabilityParams = { barberId: string; serviceId: string; date: string };

// Free times go out of date quickly, so this is refetched whenever it is
// shown again (the default) rather than cached like the lists above.
export function useAvailability(params: AvailabilityParams | null) {
  return useQuery({
    queryKey: ["availability", params?.barberId, params?.serviceId, params?.date],
    queryFn: () =>
      apiRequest<Availability>(`/availability?${new URLSearchParams(params ?? {})}`),
    enabled: params !== null,
  });
}

export function useMyBookings() {
  return useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => apiRequest<MyBookings>("/bookings/mine"),
  });
}

// After any change to a booking, both the user's list and the free times
// are out of date. That is true after a failure too: a 409 means someone
// else just took the slot, so the times on screen are wrong.
function useRefreshBookingData() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["availability"] });
  };
}

export function useCreateBooking() {
  const refreshBookingData = useRefreshBookingData();
  return useMutation({
    mutationFn: async (input: { barberId: string; serviceId: string; startsAt: string }) =>
      (await apiRequest<{ booking: Booking }>("/bookings", { method: "POST", body: input }))
        .booking,
    onSettled: refreshBookingData,
  });
}

export function useCancelBooking() {
  const refreshBookingData = useRefreshBookingData();
  return useMutation({
    mutationFn: async (bookingId: string) =>
      (
        await apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/cancel`, {
          method: "POST",
        })
      ).booking,
    onSettled: refreshBookingData,
  });
}

export function useRescheduleBooking() {
  const refreshBookingData = useRefreshBookingData();
  return useMutation({
    mutationFn: async (input: { bookingId: string; startsAt: string }) =>
      (
        await apiRequest<{ booking: Booking }>(`/bookings/${input.bookingId}/reschedule`, {
          method: "POST",
          body: { startsAt: input.startsAt },
        })
      ).booking,
    onSettled: refreshBookingData,
  });
}
