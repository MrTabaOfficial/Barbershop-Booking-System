import type { ComponentProps } from "react";
import { Link, type LinkProps } from "react-router";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center rounded-sm text-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brass text-ink hover:bg-brass-light",
  secondary:
    "border border-line-strong text-cream hover:border-brass-light hover:text-brass-light",
  danger: "border border-danger text-danger hover:bg-danger hover:text-ink",
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-5 py-2 text-sm",
  lg: "min-h-13 px-7 py-3 text-base",
};

type Appearance = { variant?: Variant; size?: Size };

function buttonClasses({ variant = "primary", size = "md" }: Appearance, className = "") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
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
