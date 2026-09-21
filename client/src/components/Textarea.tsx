import { type ComponentProps, useId } from "react";

type TextareaProps = ComponentProps<"textarea"> & { label: string; error?: string };

export function Textarea({ label, error, id, className = "", ...textareaProps }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div className={className}>
      <label htmlFor={textareaId} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`block w-full rounded-md border bg-surface px-3 py-2 text-base text-ink transition-colors duration-120 ease-standard placeholder:text-muted disabled:border-line disabled:bg-sunken disabled:text-faint ${
          error ? "border-danger ring-1 ring-danger" : "border-edge hover:border-ink"
        }`}
        {...textareaProps}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
