import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../components/Button.tsx";
import { Input } from "../components/Input.tsx";
import { Notice } from "../components/Notice.tsx";
import { showApiErrorOnForm } from "../lib/formErrors.ts";
import { useAuth } from "./AuthContext.ts";

const email = z.string().trim().pipe(z.email("Enter an email address like name@example.com"));

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "That name is too long"),
  email,
  phone: z
    .string()
    .trim()
    .max(30, "That number is too long")
    .refine((value) => value === "" || value.length >= 5, "Enter a full number or leave this empty"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Use at most 72 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

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
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting} loadingLabel="Logging in…">
        Log in
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
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

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
        label="Full name"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        placeholder="+995 5XX XX XX XX"
        hint="Only used if we need to reach you about a booking."
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting} loadingLabel="Creating your account…">
        Create account
      </Button>
    </form>
  );
}
