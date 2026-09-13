import { useState } from "react";
import { errorMessage } from "../api/http.ts";
import { useBarbers, useRescheduleBooking } from "../api/queries.ts";
import type { Booking, Shop, Slot } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Notice } from "../components/Notice.tsx";
import { formatLongDate } from "../lib/dates.ts";
import { SlotPicker } from "./SlotPicker.tsx";

type RescheduleDialogProps = {
  booking: Booking;
  shop: Shop;
  onClose: () => void;
};

export function RescheduleDialog({ booking, shop, onClose }: RescheduleDialogProps) {
  // Open on the day the booking is on now: a small shift is the most
  // likely change.
  const [date, setDate] = useState<string | null>(booking.localDate);
  const [slot, setSlot] = useState<Slot | null>(null);
  const rescheduleBooking = useRescheduleBooking();

  // The booking only carries the barber's name. Their working days come
  // from the barber list, and may be missing if they have since left.
  const barbers = useBarbers();
  const barber = barbers.data?.find((entry) => entry.id === booking.barber.id);

  function move() {
    if (!slot) {
      return;
    }
    rescheduleBooking.mutate(
      { bookingId: booking.id, startsAt: slot.startsAt },
      {
        onSuccess: onClose,
        // The free times are reloaded after a failure, so the choice that
        // was refused must not stay selected.
        onError: () => setSlot(null),
      },
    );
  }

  return (
    <Dialog
      title="Move this booking"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep current time
          </Button>
          <Button
            disabled={!slot}
            loading={rescheduleBooking.isPending}
            loadingLabel="Moving…"
            onClick={move}
          >
            {slot && date ? `Move to ${slot.localTime}` : "Move booking"}
          </Button>
        </>
      }
    >
      <p>
        {booking.service.name} with {booking.barber.name}, currently{" "}
        {formatLongDate(booking.localDate)} at {booking.localTime}.
      </p>
      <p className="text-muted">
        Pick a new time at least an hour from now. The {shop.freeCancellationHours}-hour
        cancellation rule then applies to the new time.
      </p>
      {rescheduleBooking.isError && (
        <Notice tone="error">{errorMessage(rescheduleBooking.error)}</Notice>
      )}
      <SlotPicker
        shop={shop}
        barberId={booking.barber.id}
        serviceId={booking.service.id}
        workingWeekdays={
          barber ? new Set(barber.workingHours.map((hours) => hours.weekday)) : null
        }
        date={date}
        selectedStartsAt={slot?.startsAt ?? null}
        excludeBookingId={booking.id}
        onDateChange={(day) => {
          setDate(day);
          setSlot(null);
        }}
        onSlotSelect={(day, chosen) => {
          setDate(day);
          setSlot(chosen);
        }}
      />
    </Dialog>
  );
}
