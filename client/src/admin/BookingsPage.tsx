import { type FormEvent, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAdminBarbers, useAdminBookings, useCancelBookingAsAdmin } from "../api/adminQueries.ts";
import { apiDownload, errorMessage } from "../api/http.ts";
import type { AdminBooking, BookingStatus, PaymentStatus } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { Select } from "../components/Select.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { StatusBadge, statusLabel } from "../components/StatusBadge.tsx";
import { formatLongDate, formatShortDate } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";
import { useFocusAfter } from "../lib/useFocusAfter.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { t, type TranslationKey } from "../i18n/index.ts";

const STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "expired",
];

const PAYMENT_LABELS: Record<PaymentStatus, TranslationKey> = {
  unpaid: "bookings.payment.unpaid",
  paid: "bookings.payment.paid",
  refunded: "bookings.payment.refunded",
  refund_failed: "bookings.payment.refundFailed",
};

const FILTERS = ["from", "to", "barberId", "status", "search"];

type SortKey = "startsAt" | "customer" | "barber" | "service" | "status" | "price";

const COLUMNS: { key: SortKey; label: TranslationKey; alignRight?: boolean }[] = [
  { key: "startsAt", label: "bookings.col.when" },
  { key: "customer", label: "bookings.col.customer" },
  { key: "barber", label: "bookings.col.barber" },
  { key: "service", label: "bookings.col.service" },
  { key: "status", label: "bookings.col.status" },
  { key: "price", label: "bookings.col.price", alignRight: true },
];

const TABLE_FITS = "(min-width: 60rem)";



const isCancellable = (booking: AdminBooking) =>
  booking.status === "pending" || booking.status === "confirmed";

const cancelLabel = (booking: AdminBooking) =>
  t("bookings.cancelLabel", {
    name: booking.customer.name,
    date: formatLongDate(booking.localDate),
    time: booking.localTime,
  });

const rowId = (bookingId: string) => `booking-${bookingId}`;

function CancelDialog({
  booking,
  onClose,
  onCancelled,
}: {
  booking: AdminBooking;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const cancelBooking = useCancelBookingAsAdmin();
  const depositPaid = booking.paymentStatus === "paid";
  const [refund, setRefund] = useState(true);
  return (
    <Dialog
      title={t("bookings.cancelTitle")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("bookings.keep")}
          </Button>
          <Button
            variant="danger"
            loading={cancelBooking.isPending}
            loadingLabel={t("bookings.cancelling")}
            onClick={() =>
              cancelBooking.mutate(
                { bookingId: booking.id, refund },
                {
                  onSuccess: () => {
                    onCancelled();
                    onClose();
                  },
                },
              )
            }
          >
            {t("bookings.cancelConfirm")}
          </Button>
        </>
      }
    >
      <p>
        {t("bookings.cancelWhat", {
          service: booking.service.name,
          customer: booking.customer.name,
          barber: booking.barber.name,
          date: formatLongDate(booking.localDate),
          time: booking.localTime,
        })}
      </p>
      {depositPaid ? (
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-action"
            checked={refund}
            onChange={(event) => setRefund(event.target.checked)}
          />
          {t("bookings.refundDeposit", { deposit: formatPrice(booking.depositCents) })}
        </label>
      ) : (
        <p className="text-muted">{t("bookings.noDeposit")}</p>
      )}
      <p className="text-muted">
        {t("bookings.slotFrees")}{" "}
        {booking.status === "confirmed"
          ? t("bookings.emailSent", { name: booking.customer.name })
          : t("bookings.noEmail")}
      </p>
      {cancelBooking.isError && <Notice tone="error">{errorMessage(cancelBooking.error)}</Notice>}
    </Dialog>
  );
}

export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const bookings = useAdminBookings(params.toString());
  const barbers = useAdminBarbers();
  const [cancelling, setCancelling] = useState<AdminBooking | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const tableFits = useMediaQuery(TABLE_FITS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const list = useRef<HTMLElement | null>(null);
  const keepList = (element: HTMLElement | null) => {
    list.current = element;
  };
  const focusAfterCancelling = useFocusAfter<string>(
    (bookingId) =>
      !bookings.data?.bookings.some((booking) => booking.id === bookingId && isCancellable(booking)),
    (bookingId) => document.getElementById(rowId(bookingId)) ?? list.current,
  );

  const sort = (params.get("sort") ?? "startsAt") as SortKey;
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? "1");
  const activeFilters = FILTERS.filter((name) => params.has(name)).length;
  const hasFilters = activeFilters > 0;

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) {
      if (value === "") {
        next.delete(name);
      } else {
        next.set(name, value);
      }
    }
    if (!("page" in changes)) {
      next.delete("page");
    }
    setParams(next, { replace: true });
  }

  function sortBy(key: SortKey) {
    const nextOrder = key === sort && order === "asc" ? "desc" : "asc";
    update({ sort: key, order: nextOrder });
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("search");
    update({ search: typeof value === "string" ? value.trim() : "" });
  }

  async function exportToExcel() {
    setExportError(null);
    setExporting(true);
    try {
      const query = new URLSearchParams(params);
      query.delete("page");
      await apiDownload(`/admin/bookings/export.xlsx?${query}`, "dalaki-bookings.xlsx");
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  function renderTable() {
    if (bookings.isError) {
      return (
        <ErrorState
          title={t("bookings.loadError")}
          error={bookings.error}
          onRetry={() => void bookings.refetch()}
        />
      );
    }
    if (!bookings.data) {
      return <LoadingBlock label={t("bookings.loading")} rows={6} />;
    }
    const { total, pageSize } = bookings.data;
    if (total === 0) {
      return (
        <EmptyState
          title={t(hasFilters ? "bookings.noneMatch" : "bookings.none")}
          action={
            hasFilters && (
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                {t("bookings.clearFilters")}
              </Button>
            )
          }
        />
      );
    }

    const first = (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, total);
    return (
      <div className={`rounded-lg bg-surface p-4 sm:p-6 ${bookings.isPlaceholderData ? "opacity-50 transition-opacity" : ""}`}>
        {tableFits
          ? renderRowsAsTable(bookings.data.bookings)
          : renderRowsAsList(bookings.data.bookings)}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status">
            {t("bookings.showing", { first, last, total })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              {t("bookings.previousPage")}
            </Button>
            <Button
              variant="secondary"
              disabled={last >= total}
              onClick={() => update({ page: String(page + 1) })}
            >
              {t("bookings.nextPage")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderRowsAsList(rows: AdminBooking[]) {
    return (
      <ul
        ref={keepList}
        tabIndex={-1}
        aria-label={t("bookings.list")}
        className="divide-y divide-line"
      >
        {rows.map((booking) => (
          <li key={booking.id} id={rowId(booking.id)} tabIndex={-1} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold tabular-nums">
                {formatLongDate(booking.localDate)}, {booking.localTime}
              </p>
              <StatusBadge status={booking.status} />
            </div>
            <p className="mt-1">{booking.customer.name}</p>
            <p className="text-sm text-muted">
              {booking.customer.phone ?? booking.customer.email}
            </p>
            <p className="mt-1 text-sm">
              {t("common.with", { service: booking.service.name, barber: booking.barber.name })}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{formatPrice(booking.priceCents)}</span>
                <span
                  className={`ml-2 ${
                    booking.paymentStatus === "refund_failed" ? "text-danger" : "text-muted"
                  }`}
                >
                  {t(PAYMENT_LABELS[booking.paymentStatus])}
                </span>
              </p>
              {isCancellable(booking) && (
                <Button
                  variant="quiet-danger"
                  aria-label={cancelLabel(booking)}
                  onClick={() => setCancelling(booking)}
                >
                  {t("bookings.cancel")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderRowsAsTable(rows: AdminBooking[]) {
    return (
      <>
        {/* `relative` keeps the absolutely positioned, visually hidden
            heading inside this scrolling box; without it the whole page
            would scroll sideways. */}
        <div className="relative -mx-1.5 overflow-x-auto px-1.5">
          <table
            ref={keepList}
            tabIndex={-1}
            aria-label={t("bookings.list")}
            className="w-full min-w-[46rem] text-left text-sm"
          >
            <thead className="border-b-2 border-ink text-xs">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sort !== column.key ? undefined : order === "asc" ? "ascending" : "descending"
                    }
                    className={`py-2 pr-4 font-semibold ${column.alignRight ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(column.key)}
                      className={`py-1 transition-colors duration-120 ease-standard hover:text-ink ${
                        sort === column.key ? "text-ink" : "text-muted"
                      }`}
                    >
                      {t(column.label)}
                      <span aria-hidden="true" className="ml-1 text-action">
                        {sort !== column.key ? "" : order === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="py-2">
                  <span className="sr-only">{t("bookings.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((booking) => (
                <tr key={booking.id} id={rowId(booking.id)} tabIndex={-1}>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums">
                    {formatShortDate(booking.localDate)}, {booking.localTime}
                  </td>
                  <td className="max-w-[13rem] py-3 pr-4">
                    {booking.customer.name}
                    <span className="block break-words text-xs text-muted">
                      {booking.customer.phone ?? booking.customer.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">{booking.barber.name}</td>
                  <td className="whitespace-nowrap py-3 pr-4">{booking.service.name}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
                    {formatPrice(booking.priceCents)}
                    <span
                      className={`block text-xs ${booking.paymentStatus === "refund_failed" ? "text-danger" : "text-muted"}`}
                    >
                      {t(PAYMENT_LABELS[booking.paymentStatus])}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {isCancellable(booking) && (
                      <Button
                        variant="quiet-danger"
                        aria-label={cancelLabel(booking)}
                        onClick={() => setCancelling(booking)}
                      >
                        {t("bookings.cancel")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const filterFields = (
    <div className="grid gap-3 px-0.5 sm:grid-cols-2 sm:px-1.5 lg:grid-cols-4">
      <Input
        label={t("overview.from")}
        type="date"
        value={params.get("from") ?? ""}
        onChange={(event) => update({ from: event.target.value })}
      />
      <Input
        label={t("overview.to")}
        type="date"
        value={params.get("to") ?? ""}
        onChange={(event) => update({ to: event.target.value })}
      />
      <Select
        label={t("bookings.col.barber")}
        value={params.get("barberId") ?? ""}
        onChange={(event) => update({ barberId: event.target.value })}
      >
        <option value="">{t("bookings.allBarbers")}</option>
        {barbers.data?.map((barber) => (
          <option key={barber.id} value={barber.id}>
            {barber.name}
          </option>
        ))}
      </Select>
      <Select
        label={t("bookings.col.status")}
        value={params.get("status") ?? ""}
        onChange={(event) => update({ status: event.target.value })}
      >
        <option value="">{t("bookings.anyStatus")}</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </Select>
    </div>
  );

  const searchForm = (
    <form onSubmit={search} className="flex items-end gap-2" key={params.get("search") ?? ""}>
      <Input
        className="flex-1 sm:flex-none"
        label={t("bookings.col.customer")}
        name="search"
        type="search"
        placeholder={t("bookings.searchPlaceholder")}
        defaultValue={params.get("search") ?? ""}
      />
      <Button type="submit" variant="secondary">
        {t("bookings.search")}
      </Button>
    </form>
  );

  const exportButton = (
    <Button
      variant="secondary"
      loading={exporting}
      loadingLabel={t("bookings.exporting")}
      onClick={exportToExcel}
    >
      {t("bookings.export")}
    </Button>
  );

  const sortControls = (
    <div className="flex items-end gap-2">
      <Select
        label={t("bookings.sortBy")}
        className="flex-1"
        value={sort}
        onChange={(event) => update({ sort: event.target.value, order })}
      >
        {COLUMNS.map((column) => (
          <option key={column.key} value={column.key}>
            {t(column.label)}
          </option>
        ))}
      </Select>
      <Button
        variant="secondary"
        onClick={() => update({ sort, order: order === "asc" ? "desc" : "asc" })}
      >
        {t(order === "asc" ? "bookings.ascending" : "bookings.descending")}
      </Button>
    </div>
  );

  return (
    <>
      <title>{`${t("admin.bookings")} ${t("admin.titleSuffix")}`}</title>
      <h1 className="sr-only">{t("admin.bookings")}</h1>

      {tableFits ? (
        <>
          {filterFields}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 px-0.5 sm:px-1.5">
            {searchForm}
            {exportButton}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 px-0.5 sm:px-1.5">
            <Button
              variant="secondary"
              aria-expanded={filtersOpen}
              aria-controls="booking-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              {filtersOpen
                ? t("bookings.hideFilters")
                : activeFilters > 0
                  ? t("bookings.filtersCount", { count: activeFilters })
                  : t("bookings.filters")}
            </Button>
            {exportButton}
          </div>
          {filtersOpen && (
            <div id="booking-filters" className="mt-4 space-y-3">
              {filterFields}
              {searchForm}
              {sortControls}
            </div>
          )}
        </>
      )}

      {exportError && (
        <Notice tone="error" className="mt-4">
          {exportError}
        </Notice>
      )}

      <div className="mt-5">{renderTable()}</div>

      {cancelling && (
        <CancelDialog
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => focusAfterCancelling(cancelling.id)}
        />
      )}
    </>
  );
}
