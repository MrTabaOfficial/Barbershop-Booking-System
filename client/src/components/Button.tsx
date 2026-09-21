import type { ComponentProps } from "react";
import { Link, type LinkProps } from "react-router";

type Variant = "primary" | "secondary" | "quiet" | "quiet-danger" | "danger";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center text-center font-semibold transition-colors duration-120 ease-standard disabled:cursor-not-allowed";

const FILLED =
  "rounded-md border-2 active:translate-y-px disabled:translate-y-0 disabled:border-transparent disabled:bg-sunken disabled:text-faint";

const QUIET =
  "min-h-11 px-1 underline decoration-2 underline-offset-4 disabled:text-faint disabled:no-underline";

const VARIANTS: Record<Variant, string> = {
  primary: `${FILLED} border-transparent bg-action text-on-action hover:bg-action-hover active:bg-action-pressed`,
  secondary: `${FILLED} border-ink bg-surface text-ink hover:border-action hover:bg-action-tint hover:text-action-hover`,
  danger: `${FILLED} border-transparent bg-danger text-on-action hover:bg-danger-strong`,
  quiet: `${QUIET} text-action hover:text-action-pressed`,
  "quiet-danger": `${QUIET} text-danger hover:text-danger-strong`,
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-5 py-2",
  lg: "min-h-14 px-7 py-3",
};

type Appearance = { variant?: Variant; size?: Size };

export function buttonClasses({ variant = "primary", size = "md" }: Appearance, className = "") {
  const isQuiet = variant === "quiet" || variant === "quiet-danger";
  return `${BASE} ${VARIANTS[variant]} ${isQuiet ? "" : SIZES[size]} ${className}`;
}

type ButtonProps = ComponentProps<"button"> &
  Appearance & {
    loading?: boolean;
    loadingLabel?: string;
  };

export function Button({
  variant,
  size,
  loading = false,
  loadingLabel = "Please wait…",
  className,
  disabled,
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonClasses({ variant, size }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...linkProps }: LinkProps & Appearance) {
  return <Link className={buttonClasses({ variant, size }, className)} {...linkProps} />;
}
