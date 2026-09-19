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

type AvailabilityParams = {
  barberId: string;
  serviceId: string;
  date: string;
  excludeBookingId?: string;
};

export function useAvailability(params: AvailabilityParams | null) {
  return useQuery({
    queryKey: [
      "availability",
      params?.barberId,
      params?.serviceId,
      params?.date,
      params?.excludeBookingId,
    ],
    queryFn: () => {
      const { excludeBookingId, ...required } = params ?? {};
      const query = new URLSearchParams(required);
      if (excludeBookingId) {
        query.set("excludeBookingId", excludeBookingId);
      }
      return apiRequest<Availability>(`/availability?${query}`);
    },
    enabled: params !== null,
  });
}

export function useMyBookings(awaitingPaymentOf: string | null = null) {
  return useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => apiRequest<MyBookings>("/bookings/mine"),
    refetchInterval: (query) => {
      const stillPending = query.state.data?.upcoming.some(
        (booking) => booking.id === awaitingPaymentOf && booking.status === "pending",
      );
      return stillPending ? 2000 : false;
    },
  });
}

// The lists are refreshed after a failure too, because a 409 means someone
// else just took the slot and the times on screen are wrong.
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
    mutationFn: (input: { barberId: string; serviceId: string; startsAt: string }) =>
      apiRequest<{ booking: Booking; checkoutUrl: string | null }>("/bookings", {
        method: "POST",
        body: input,
      }),
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
