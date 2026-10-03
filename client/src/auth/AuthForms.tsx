import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../components/Button.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { t } from "../i18n/index.ts";
import { showApiErrorOnForm } from "../lib/formErrors.ts";
import { useAuth } from "./AuthContext.ts";

const email = () => z.string().trim().pipe(z.email(t("form.v.email")));

const loginSchema = () =>
  z.object({
    email: email(),
    password: z.string().min(1, t("form.v.password")),
  });

const registerSchema = () =>
  z.object({
    name: z.string().trim().min(1, t("form.v.name")).max(100, t("form.v.nameLong")),
    email: email(),
    phone: z
      .string()
      .trim()
      .max(30, t("form.v.phoneLong"))
      .refine((value) => value === "" || value.length >= 5, t("form.v.phone")),
    password: z.string().min(8, t("form.v.passwordShort")).max(72, t("form.v.passwordLong")),
  });

type LoginValues = z.infer<ReturnType<typeof loginSchema>>;
type RegisterValues = z.infer<ReturnType<typeof registerSchema>>;

export function LoginForm() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema()) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      setFormError(showApiErrorOnForm(error, ["email", "password"], setError));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Notice tone="error">{formError}</Notice>}
      <Input
        label={t("form.email")}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label={t("form.password")}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={isSubmitting}
        loadingLabel={t("form.loggingIn")}
      >
        {t("auth.logIn")}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const { register: registerAccount } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema()) });

  const onSubmit = handleSubmit(async ({ phone, ...values }) => {
    setFormError(null);
    try {
      await registerAccount(phone === "" ? values : { ...values, phone });
    } catch (error) {
      setFormError(
        showApiErrorOnForm(error, ["name", "email", "phone", "password"], setError),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Notice tone="error">{formError}</Notice>}
      <Input
        label={t("form.name")}
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label={t("form.email")}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label={t("form.phone")}
        type="tel"
        autoComplete="tel"
        placeholder="+995 5XX XX XX XX"
        hint={t("form.phoneHint")}
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Input
        label={t("form.password")}
        type="password"
        autoComplete="new-password"
        hint={t("form.passwordHint")}
        error={errors.password?.message}
        {...register("password")}
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={isSubmitting}
        loadingLabel={t("form.creatingAccount")}
      >
        {t("form.createAccount")}
      </Button>
    </form>
  );
}
