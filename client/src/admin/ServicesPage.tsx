import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminServices, useSaveService } from "../api/adminQueries.ts";
import { errorMessage } from "../api/http.ts";
import type { AdminService } from "../api/types.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { Tag } from "../components/Tag.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { Textarea } from "../components/Textarea.tsx";
import { showApiErrorOnForm } from "../lib/formErrors.ts";
import { formatDuration, formatPrice, parseLari, toLariInput } from "../lib/format.ts";
import { countActive } from "./activeEntries.ts";

const amount = (message: string) =>
  z.string().refine((value) => parseLari(value) !== null, message);

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Give the service a name").max(100),
  description: z.string().trim().max(500, "Keep it under 500 characters"),
  durationMinutes: z
    .string()
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= 15 && Number(value) % 15 === 0,
      "Use a multiple of 15 minutes",
    ),
  priceCents: amount("Enter a price, like 45 or 45.50"),
  depositCents: amount("Enter a deposit, like 15"),
});
type ServiceValues = z.infer<typeof serviceSchema>;
const FIELDS = ["name", "description", "durationMinutes", "priceCents", "depositCents"] as const;

function ServiceDialog({ service, onClose }: { service: AdminService | null; onClose: () => void }) {
  const saveService = useSaveService();
  const formId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      durationMinutes: String(service?.durationMinutes ?? 30),
      priceCents: service ? toLariInput(service.priceCents) : "",
      depositCents: service ? toLariInput(service.depositCents) : "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await saveService.mutateAsync({
        id: service?.id,
        name: values.name,
        description: values.description === "" ? null : values.description,
        durationMinutes: Number(values.durationMinutes),
        priceCents: parseLari(values.priceCents) ?? 0,
        depositCents: parseLari(values.depositCents) ?? 0,
      });
      onClose();
    } catch (error) {
      setFormError(showApiErrorOnForm(error, FIELDS, setError));
    }
  });

  return (
    <Dialog
      title={service ? `Edit ${service.name}` : "Add a service"}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Discard
          </Button>
          <Button type="submit" form={formId} loading={saveService.isPending} loadingLabel="Saving…">
            Save service
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4 text-base">
        {formError && <Notice tone="error">{formError}</Notice>}
        <Input label="Name" error={errors.name?.message} {...register("name")} />
        <Textarea
          label="Description (optional)"
          error={errors.description?.message}
          {...register("description")}
        />
        <Input
          label="Length in minutes"
          inputMode="numeric"
          hint="Existing bookings keep the length they were made with."
          error={errors.durationMinutes?.message}
          {...register("durationMinutes")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Price in ₾"
            inputMode="decimal"
            error={errors.priceCents?.message}
            {...register("priceCents")}
          />
          <Input
            label="Deposit in ₾"
            inputMode="decimal"
            error={errors.depositCents?.message}
            {...register("depositCents")}
          />
        </div>
      </form>
    </Dialog>
  );
}

export function ServicesPage() {
  const services = useAdminServices();
  const saveService = useSaveService();
  const [editing, setEditing] = useState<AdminService | null | undefined>(undefined);

  function renderList() {
    if (services.isPending) {
      return <LoadingBlock label="Loading services" rows={5} />;
    }
    if (services.isError) {
      return (
        <ErrorState
          title="We couldn't load the services"
          error={services.error}
          onRetry={() => void services.refetch()}
        />
      );
    }
    if (services.data.length === 0) {
      return (
        <EmptyState title="No services yet">
          Add the first one and it will appear on the website straight away.
        </EmptyState>
      );
    }
    return (
      <ul className="divide-y divide-line border-y border-line">
        {services.data.map((service) => (
          <li
            key={service.id}
            className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className={service.isActive ? "" : "text-muted"}>
              <p className="text-lg font-semibold">
                {service.name}
                {!service.isActive && (
                  <Tag tone="neutral" className="ml-2.5 align-middle">
                    Inactive
                  </Tag>
                )}
              </p>
              <p className="text-sm text-muted">
                {formatDuration(service.durationMinutes)}, {formatPrice(service.priceCents)},
                deposit {formatPrice(service.depositCents)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <Button
                variant="secondary"
                aria-label={`Edit ${service.name}`}
                onClick={() => setEditing(service)}
              >
                Edit
              </Button>
              <Button
                variant="quiet"
                disabled={saveService.isPending}
                aria-label={`${service.isActive ? "Deactivate" : "Activate"} ${service.name}`}
                onClick={() => saveService.mutate({ id: service.id, isActive: !service.isActive })}
              >
                {service.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <title>Services · Admin · Dalaki</title>
      <h1 className="sr-only">Services</h1>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-muted">{services.data && countActive(services.data, "service")}</p>
        <Button onClick={() => setEditing(null)}>Add a service</Button>
      </div>
      {saveService.isError && (
        <Notice tone="error" className="mb-4">
          {errorMessage(saveService.error)}
        </Notice>
      )}
      {renderList()}
      {editing !== undefined && (
        <ServiceDialog service={editing} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}
