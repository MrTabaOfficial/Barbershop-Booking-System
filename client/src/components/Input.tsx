import { type ComponentProps, useId } from "react";

type InputProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Input({ label, error, hint, id, className = "", ...inputProps }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`block min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-base text-ink transition-colors duration-120 ease-standard placeholder:text-muted disabled:border-line disabled:bg-sunken disabled:text-faint ${
          error ? "border-danger ring-1 ring-danger" : "border-edge hover:border-ink"
        }`}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
