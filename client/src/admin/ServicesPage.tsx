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
import { t } from "../i18n/index.ts";
import { countActive } from "./activeEntries.ts";

const amount = (message: string) =>
  z.string().refine((value) => parseLari(value) !== null, message);

const serviceSchema = () =>
  z.object({
    name: z.string().trim().min(1, t("services.v.name")).max(100),
    description: z.string().trim().max(500, t("services.v.description")),
    durationMinutes: z
      .string()
      .refine(
        (value) => /^\d+$/.test(value) && Number(value) >= 15 && Number(value) % 15 === 0,
        t("services.v.length"),
      ),
    priceCents: amount(t("services.v.price")),
    depositCents: amount(t("services.v.deposit")),
  });
type ServiceValues = z.infer<ReturnType<typeof serviceSchema>>;
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
    resolver: zodResolver(serviceSchema()),
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
      title={service ? t("services.edit", { name: service.name }) : t("services.add")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("services.discard")}
          </Button>
          <Button type="submit" form={formId} loading={saveService.isPending} loadingLabel={t("services.saving")}>
            {t("services.save")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4 text-base">
        {formError && <Notice tone="error">{formError}</Notice>}
        <Input label={t("services.name")} error={errors.name?.message} {...register("name")} />
        <Textarea
          label={t("services.description")}
          error={errors.description?.message}
          {...register("description")}
        />
        <Input
          label={t("services.length")}
          inputMode="numeric"
          hint={t("services.lengthHint")}
          error={errors.durationMinutes?.message}
          {...register("durationMinutes")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("services.price")}
            inputMode="decimal"
            error={errors.priceCents?.message}
            {...register("priceCents")}
          />
          <Input
            label={t("services.deposit")}
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
      return <LoadingBlock label={t("services.loading")} rows={5} />;
    }
    if (services.isError) {
      return (
        <ErrorState
          title={t("services.loadError")}
          error={services.error}
          onRetry={() => void services.refetch()}
        />
      );
    }
    if (services.data.length === 0) {
      return (
        <EmptyState title={t("services.none")}>{t("services.noneHint")}</EmptyState>
      );
    }
    return (
      <ul className="rounded-lg bg-surface p-4 sm:p-6 divide-y divide-line">
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
                    {t("services.inactive")}
                  </Tag>
                )}
              </p>
              <p className="text-sm text-muted">
                {t("services.summary", {
                  duration: formatDuration(service.durationMinutes),
                  price: formatPrice(service.priceCents),
                  deposit: formatPrice(service.depositCents),
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <Button
                variant="secondary"
                aria-label={t("services.edit", { name: service.name })}
                onClick={() => setEditing(service)}
              >
                {t("services.editButton")}
              </Button>
              <Button
                variant="quiet"
                disabled={saveService.isPending}
                aria-label={t(service.isActive ? "services.deactivateName" : "services.activateName", { name: service.name })}
                onClick={() => saveService.mutate({ id: service.id, isActive: !service.isActive })}
              >
                {t(service.isActive ? "services.deactivate" : "services.activate")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <title>{`${t("admin.services")} ${t("admin.titleSuffix")}`}</title>
      <h1 className="sr-only">{t("admin.services")}</h1>
      <div className="mb-3 flex items-center justify-between gap-4 px-0.5 sm:px-1.5">
        <p className="text-muted">{services.data && countActive(services.data, "service")}</p>
        <Button onClick={() => setEditing(null)}>{t("services.add")}</Button>
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
