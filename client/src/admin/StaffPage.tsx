import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAdminBarbers, useCreateBarber, useUpdateBarber } from "../api/adminQueries.ts";
import { errorMessage } from "../api/http.ts";
import type { AdminBarber } from "../api/types.ts";
import { describeWorkingDays } from "../booking/workingDays.ts";
import { Button } from "../components/Button.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { Tag } from "../components/Tag.tsx";
import { EmptyState, ErrorState, LoadingBlock } from "../components/States.tsx";
import { Textarea } from "../components/Textarea.tsx";
import { showApiErrorOnForm } from "../lib/formErrors.ts";
import { t } from "../i18n/index.ts";
import { countActive } from "./activeEntries.ts";
import { WorkingHoursDialog } from "./WorkingHoursDialog.tsx";

const name = () => z.string().trim().min(1, t("staff.v.name")).max(100);
const bio = () => z.string().trim().max(1000, t("staff.v.bio"));

const newBarberSchema = () =>
  z.object({
    name: name(),
    email: z.string().trim().pipe(z.email(t("staff.v.email"))),
    password: z.string().min(8, t("staff.v.password")).max(72),
    bio: bio(),
  });
type NewBarberValues = z.infer<ReturnType<typeof newBarberSchema>>;

const editBarberSchema = () => z.object({ name: name(), bio: bio() });
type EditBarberValues = z.infer<ReturnType<typeof editBarberSchema>>;

function AddBarberDialog({ onClose }: { onClose: () => void }) {
  const createBarber = useCreateBarber();
  const formId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NewBarberValues>({ resolver: zodResolver(newBarberSchema()) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createBarber.mutateAsync({ ...values, bio: values.bio === "" ? null : values.bio });
      onClose();
    } catch (error) {
      setFormError(showApiErrorOnForm(error, ["name", "email", "password", "bio"], setError));
    }
  });

  return (
    <Dialog
      title={t("staff.add")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("services.discard")}
          </Button>
          <Button type="submit" form={formId} loading={createBarber.isPending} loadingLabel={t("barber.adding")}>
            {t("staff.addButton")}
          </Button>
        </>
      }
    >
      <p className="text-muted">{t("staff.addHint")}</p>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4 text-base">
        {formError && <Notice tone="error">{formError}</Notice>}
        <Input label={t("form.name")} error={errors.name?.message} {...register("name")} />
        <Input
          label={t("form.email")}
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label={t("form.password")}
          type="password"
          autoComplete="new-password"
          hint={t("staff.passwordHint")}
          error={errors.password?.message}
          {...register("password")}
        />
        <Textarea label={t("staff.bio")} error={errors.bio?.message} {...register("bio")} />
      </form>
    </Dialog>
  );
}

function EditBarberDialog({ barber, onClose }: { barber: AdminBarber; onClose: () => void }) {
  const updateBarber = useUpdateBarber();
  const formId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditBarberValues>({
    resolver: zodResolver(editBarberSchema()),
    defaultValues: { name: barber.name, bio: barber.bio ?? "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await updateBarber.mutateAsync({
        id: barber.id,
        name: values.name,
        bio: values.bio === "" ? null : values.bio,
      });
      onClose();
    } catch (error) {
      setFormError(showApiErrorOnForm(error, ["name", "bio"], setError));
    }
  });

  return (
    <Dialog
      title={t("staff.edit", { name: barber.name })}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("services.discard")}
          </Button>
          <Button type="submit" form={formId} loading={updateBarber.isPending} loadingLabel={t("services.saving")}>
            {t("staff.save")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4 text-base">
        {formError && <Notice tone="error">{formError}</Notice>}
        <Input label={t("form.name")} error={errors.name?.message} {...register("name")} />
        <Textarea label={t("staff.bioRequired")} rows={5} error={errors.bio?.message} {...register("bio")} />
      </form>
    </Dialog>
  );
}

type OpenDialog =
  | { kind: "add" }
  | { kind: "edit" | "hours"; barber: AdminBarber }
  | null;

export function StaffPage() {
  const barbers = useAdminBarbers();
  const updateBarber = useUpdateBarber();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  function renderList() {
    if (barbers.isPending) {
      return <LoadingBlock label={t("staff.loading")} />;
    }
    if (barbers.isError) {
      return (
        <ErrorState
          title={t("staff.loadError")}
          error={barbers.error}
          onRetry={() => void barbers.refetch()}
        />
      );
    }
    if (barbers.data.length === 0) {
      return <EmptyState title={t("staff.none")}>{t("staff.noneHint")}</EmptyState>;
    }
    return (
      <ul className="rounded-lg bg-surface p-4 sm:p-6 divide-y divide-line">
        {barbers.data.map((barber) => (
          <li
            key={barber.id}
            className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div className={barber.isActive ? "" : "text-muted"}>
              <p className="text-lg font-semibold">
                {barber.name}
                {!barber.isActive && (
                  <Tag tone="neutral" className="ml-2.5 align-middle">
                    {t("services.inactive")}
                  </Tag>
                )}
              </p>
              <p className="text-sm text-muted">{barber.email}</p>
              <p className="text-sm font-semibold text-muted">
                {barber.workingHours.length > 0
                  ? describeWorkingDays(barber.workingHours)
                  : t("staff.noHours")}
              </p>
              {barber.bio && <p className="mt-2 max-w-xl text-sm">{barber.bio}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 whitespace-nowrap">
              <Button
                variant="secondary"
                aria-label={t("staff.edit", { name: barber.name })}
                onClick={() => setDialog({ kind: "edit", barber })}
              >
                {t("services.editButton")}
              </Button>
              <Button
                variant="secondary"
                aria-label={t("staff.workingHoursOf", { name: barber.name })}
                onClick={() => setDialog({ kind: "hours", barber })}
              >
                {t("staff.workingHours")}
              </Button>
              <Button
                variant="quiet"
                className="ml-2"
                disabled={updateBarber.isPending}
                aria-label={t(barber.isActive ? "services.deactivateName" : "services.activateName", { name: barber.name })}
                onClick={() => updateBarber.mutate({ id: barber.id, isActive: !barber.isActive })}
              >
                {t(barber.isActive ? "services.deactivate" : "services.activate")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <title>{`${t("admin.staff")} ${t("admin.titleSuffix")}`}</title>
      <h1 className="sr-only">{t("admin.staff")}</h1>
      <div className="mb-3 flex items-center justify-between gap-4 px-0.5 sm:px-1.5">
        <p className="text-muted">{barbers.data && countActive(barbers.data, "barber")}</p>
        <Button onClick={() => setDialog({ kind: "add" })}>{t("staff.add")}</Button>
      </div>
      {updateBarber.isError && (
        <Notice tone="error" className="mb-4">
          {errorMessage(updateBarber.error)}
        </Notice>
      )}
      {renderList()}

      {dialog?.kind === "add" && <AddBarberDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && (
        <EditBarberDialog barber={dialog.barber} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "hours" && (
        <WorkingHoursDialog barber={dialog.barber} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
