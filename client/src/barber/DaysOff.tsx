import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, errorMessage } from "../api/http.ts";
import { useAddDayOff, useDaysOff, useRemoveDayOff } from "../api/barberQueries.ts";
import { Button } from "../components/Button.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { t } from "../i18n/index.ts";
import { formatLongDate } from "../lib/dates.ts";
import { showApiErrorOnForm } from "../lib/formErrors.ts";
import { useFocusAfter } from "../lib/useFocusAfter.ts";

const dayOffSchema = () =>
  z.object({
    date: z.string().min(1, t("barber.v.date")),
    reason: z.string().trim().max(200, t("barber.v.reason")),
  });
type DayOffValues = z.infer<ReturnType<typeof dayOffSchema>>;

type BlockingBooking = { id: string; localTime: string; customerName: string; serviceName: string };

function blockingBookings(error: unknown): BlockingBooking[] {
  if (!(error instanceof ApiError) || error.code !== "DAY_HAS_BOOKINGS") {
    return [];
  }
  const details = error.details as { bookings?: BlockingBooking[] } | undefined;
  return Array.isArray(details?.bookings) ? details.bookings : [];
}

function AddDayOffForm({ today }: { today: string }) {
  const addDayOff = useAddDayOff();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<DayOffValues>({
    resolver: zodResolver(dayOffSchema()),
    defaultValues: { date: "", reason: "" },
  });

  const onSubmit = handleSubmit(async ({ date, reason }) => {
    setFormError(null);
    try {
      await addDayOff.mutateAsync(reason === "" ? { date } : { date, reason });
      reset();
    } catch (error) {
      setFormError(showApiErrorOnForm(error, ["date", "reason"], setError));
    }
  });

  const blocking = blockingBookings(addDayOff.error);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <Notice tone="error">
          <p>{formError}</p>
          {blocking.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {blocking.map((booking) => (
                <li key={booking.id}>
                  {booking.localTime} {booking.customerName}, {booking.serviceName}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <Input
          label={t("barber.date")}
          type="date"
          min={today}
          error={errors.date?.message}
          {...register("date")}
        />
        <Input
          label={t("barber.reason")}
          hint={t("barber.reasonHint")}
          error={errors.reason?.message}
          {...register("reason")}
        />
      </div>
      <Button type="submit" loading={addDayOff.isPending} loadingLabel={t("barber.adding")}>
        {t("barber.addDayOff")}
      </Button>
    </form>
  );
}

export function DaysOff({ today }: { today: string }) {
  const daysOff = useDaysOff();
  const removeDayOff = useRemoveDayOff();
  const section = useRef<HTMLElement>(null);
  const focusAfterRemoving = useFocusAfter<string>(
    (dayOffId) => !daysOff.data?.some((dayOff) => dayOff.id === dayOffId),
    () => section.current,
  );

  function renderList() {
    if (daysOff.isPending) {
      return <LoadingBlock label={t("barber.daysOffLoading")} rows={2} />;
    }
    if (daysOff.isError) {
      return (
        <ErrorState
          title={t("barber.daysOffError")}
          error={daysOff.error}
          onRetry={() => void daysOff.refetch()}
        />
      );
    }
    if (daysOff.data.length === 0) {
      return (
        <EmptyState title={t("barber.noDaysOff")}>{t("barber.noDaysOffHint")}</EmptyState>
      );
    }
    return (
      <ul className="divide-y divide-line border-y border-line">
        {daysOff.data.map((dayOff) => (
          <li key={dayOff.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p>{formatLongDate(dayOff.date)}</p>
              {dayOff.reason && <p className="text-sm text-muted">{dayOff.reason}</p>}
            </div>
            <Button
              variant="quiet"
              disabled={removeDayOff.isPending}
              aria-label={t("barber.removeDayOff", { date: formatLongDate(dayOff.date) })}
              onClick={() =>
                removeDayOff.mutate(dayOff.id, { onSuccess: () => focusAfterRemoving(dayOff.id) })
              }
            >
              {t("barber.remove")}
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section ref={section} tabIndex={-1} aria-labelledby="days-off-title" className="rounded-lg bg-surface p-4 sm:p-6 space-y-6">
      <h2 id="days-off-title" className="text-xl">
        {t("barber.daysOff")}
      </h2>
      {renderList()}
      {removeDayOff.isError && <Notice tone="error">{errorMessage(removeDayOff.error)}</Notice>}
      <AddDayOffForm today={today} />
    </section>
  );
}
