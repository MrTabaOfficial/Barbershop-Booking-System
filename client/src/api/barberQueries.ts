import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./http.ts";
import type { DayOff, ScheduleBooking, ScheduleDay } from "./types.ts";

// Everything the barber dashboard reads sits under the ["barber"] key, so
// one invalidation refreshes all of it after a change.

export function useSchedule(from: string, to: string) {
  return useQuery({
    queryKey: ["barber", "schedule", from, to],
    queryFn: async () =>
      (await apiRequest<{ days: ScheduleDay[] }>(`/barber/schedule?from=${from}&to=${to}`)).days,
  });
}

export function useDaysOff() {
  return useQuery({
    queryKey: ["barber", "days-off"],
    queryFn: async () => (await apiRequest<{ daysOff: DayOff[] }>("/barber/days-off")).daysOff,
  });
}

function useRefreshBarberData() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["barber"] });
}

export type Outcome = "complete" | "no-show";

export function useRecordOutcome() {
  const refresh = useRefreshBarberData();
  return useMutation({
    mutationFn: async (input: { bookingId: string; outcome: Outcome }) =>
      (
        await apiRequest<{ booking: ScheduleBooking }>(
          `/barber/bookings/${input.bookingId}/${input.outcome}`,
          { method: "POST" },
        )
      ).booking,
    onSettled: refresh,
  });
}

export function useAddDayOff() {
  const refresh = useRefreshBarberData();
  return useMutation({
    mutationFn: async (input: { date: string; reason?: string }) =>
      (await apiRequest<{ dayOff: DayOff }>("/barber/days-off", { method: "POST", body: input }))
        .dayOff,
    onSuccess: refresh,
  });
}

export function useRemoveDayOff() {
  const refresh = useRefreshBarberData();
  return useMutation({
    mutationFn: (dayOffId: string) =>
      apiRequest<void>(`/barber/days-off/${dayOffId}`, { method: "DELETE" }),
    onSettled: refresh,
  });
}
