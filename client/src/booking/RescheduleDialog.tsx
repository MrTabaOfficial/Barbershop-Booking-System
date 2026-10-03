import { useState } from "react";
import { errorMessage } from "../api/http.ts";
import { useBarbers, useRescheduleBooking } from "../api/queries.ts";
import type { Booking, Shop, Slot } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Notice } from "../components/Notice.tsx";
import { t } from "../i18n/index.ts";
import { formatLongDate } from "../lib/dates.ts";
import { SlotPicker } from "./SlotPicker.tsx";

type RescheduleDialogProps = {
  booking: Booking;
  shop: Shop;
  onClose: () => void;
};

export function RescheduleDialog({ booking, shop, onClose }: RescheduleDialogProps) {
  const [date, setDate] = useState<string | null>(booking.localDate);
  const [slot, setSlot] = useState<Slot | null>(null);
  const rescheduleBooking = useRescheduleBooking();

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
        onError: () => setSlot(null),
      },
    );
  }

  return (
    <Dialog
      title={t("move.title")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("move.keep")}
          </Button>
          <Button
            disabled={!slot}
            loading={rescheduleBooking.isPending}
            loadingLabel={t("move.moving")}
            onClick={move}
          >
            {slot && date ? t("move.to", { time: slot.localTime }) : t("move.button")}
          </Button>
        </>
      }
    >
      <p>
        {t("move.current", {
          service: booking.service.name,
          barber: booking.barber.name,
          date: formatLongDate(booking.localDate),
          time: booking.localTime,
        })}
      </p>
      <p className="text-muted">{t("move.rule", { hours: shop.freeCancellationHours })}</p>
      {rescheduleBooking.isError && (
        <Notice tone="error">{errorMessage(rescheduleBooking.error)}</Notice>
      )}
      <SlotPicker
        shop={shop}
        barberId={booking.barber.id}
        serviceId={booking.service.id}
        workingHours={barber?.workingHours ?? null}
        date={date}
        selectedStartsAt={slot?.startsAt ?? null}
        excludeBookingId={booking.id}
        currentStartsAt={booking.startsAt}
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
