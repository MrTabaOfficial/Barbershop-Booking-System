import { type FormEvent, useState } from "react";
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
import { formatLongDate } from "../lib/dates.ts";
import { formatPrice } from "../lib/format.ts";

const STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "expired",
];

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Deposit unpaid",
  paid: "Deposit paid",
  refunded: "Deposit refunded",
  refund_failed: "Refund failed",
};

const FILTERS = ["from", "to", "barberId", "status", "search"];

type SortKey = "startsAt" | "customer" | "barber" | "service" | "status" | "price";

const COLUMNS: { key: SortKey; label: string; alignRight?: boolean }[] = [
  { key: "startsAt", label: "When" },
  { key: "customer", label: "Customer" },
  { key: "barber", label: "Barber" },
  { key: "service", label: "Service" },
  { key: "status", label: "Status" },
  { key: "price", label: "Price", alignRight: true },
];

function CancelDialog({ booking, onClose }: { booking: AdminBooking; onClose: () => void }) {
  const cancelBooking = useCancelBookingAsAdmin();
  const depositPaid = booking.paymentStatus === "paid";
  const [refund, setRefund] = useState(true);
  return (
    <Dialog
      title="Cancel this booking?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            loading={cancelBooking.isPending}
            loadingLabel="Cancelling…"
            onClick={() =>
              cancelBooking.mutate({ bookingId: booking.id, refund }, { onSuccess: onClose })
            }
          >
            Cancel booking
          </Button>
        </>
      }
    >
      <p>
        {booking.service.name} for {booking.customer.name} with {booking.barber.name} on{" "}
        {formatLongDate(booking.localDate)} at {booking.localTime}.
      </p>
      {depositPaid ? (
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-brass"
            checked={refund}
            onChange={(event) => setRefund(event.target.checked)}
          />
          Refund the {formatPrice(booking.depositCents)} deposit
        </label>
      ) : (
        <p className="text-muted">No deposit was paid, so there is nothing to refund.</p>
      )}
      <p className="text-muted">
        The time becomes free for other customers straight away.{" "}
        {booking.status === "confirmed"
          ? `${booking.customer.name} gets an email saying the booking is cancelled and what happened to the deposit.`
          : "The booking was never confirmed, so no email is sent."}
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

  const sort = (params.get("sort") ?? "startsAt") as SortKey;
  const order = params.get("order") ?? "desc";
  const page = Number(params.get("page") ?? "1");
  const hasFilters = FILTERS.some((name) => params.has(name));

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
          title="We couldn't load the bookings"
          error={bookings.error}
          onRetry={() => void bookings.refetch()}
        />
      );
    }
    if (!bookings.data) {
      return <LoadingBlock label="Loading bookings" rows={6} />;
    }
    const { total, pageSize } = bookings.data;
    if (total === 0) {
      return (
        <EmptyState
          title={hasFilters ? "No bookings match these filters" : "No bookings yet"}
          action={
            hasFilters && (
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            )
          }
        />
      );
    }

    const first = (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, total);
    return (
      <div className={bookings.isPlaceholderData ? "opacity-50 transition-opacity" : ""}>
        {/* `relative` keeps the absolutely positioned, visually hidden
            heading inside this scrolling box; without it the whole page
            would scroll sideways. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-line-strong">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sort !== column.key ? undefined : order === "asc" ? "ascending" : "descending"
                    }
                    className={`py-2 pr-4 font-medium ${column.alignRight ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(column.key)}
                      className="py-1 text-muted hover:text-cream"
                    >
                      {column.label}
                      <span aria-hidden="true" className="ml-1 text-brass-light">
                        {sort !== column.key ? "" : order === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bookings.data.bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums">
                    {formatLongDate(booking.localDate)}, {booking.localTime}
                  </td>
                  <td className="py-3 pr-4">
                    {booking.customer.name}
                    <span className="block text-xs text-muted">
                      {booking.customer.phone ?? booking.customer.email}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{booking.barber.name}</td>
                  <td className="py-3 pr-4">{booking.service.name}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
                    {formatPrice(booking.priceCents)}
                    <span
                      className={`block text-xs ${booking.paymentStatus === "refund_failed" ? "text-danger" : "text-muted"}`}
                    >
                      {PAYMENT_LABELS[booking.paymentStatus]}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {(booking.status === "pending" || booking.status === "confirmed") && (
                      <Button
                        variant="danger"
                        className="px-3"
                        aria-label={`Cancel ${booking.customer.name}'s booking on ${formatLongDate(booking.localDate)} at ${booking.localTime}`}
                        onClick={() => setCancelling(booking)}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status">
            Showing {first} to {last} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              Previous page
            </Button>
            <Button
              variant="secondary"
              disabled={last >= total}
              onClick={() => update({ page: String(page + 1) })}
            >
              Next page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <title>Bookings · Admin · Dalaki</title>
      <h2 className="sr-only">Bookings</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="From"
          type="date"
          value={params.get("from") ?? ""}
          onChange={(event) => update({ from: event.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={params.get("to") ?? ""}
          onChange={(event) => update({ to: event.target.value })}
        />
        <Select
          label="Barber"
          value={params.get("barberId") ?? ""}
          onChange={(event) => update({ barberId: event.target.value })}
        >
          <option value="">All barbers</option>
          {barbers.data?.map((barber) => (
            <option key={barber.id} value={barber.id}>
              {barber.name}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={params.get("status") ?? ""}
          onChange={(event) => update({ status: event.target.value })}
        >
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <form onSubmit={search} className="flex items-end gap-2" key={params.get("search") ?? ""}>
          <Input
            label="Customer"
            name="search"
            type="search"
            placeholder="Name, email or phone"
            defaultValue={params.get("search") ?? ""}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <Button
          variant="secondary"
          loading={exporting}
          loadingLabel="Preparing the file…"
          onClick={exportToExcel}
        >
          Export to Excel
        </Button>
      </div>

      {exportError && (
        <Notice tone="error" className="mt-4">
          {exportError}
        </Notice>
      )}

      <div className="mt-8">{renderTable()}</div>

      {cancelling && <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
