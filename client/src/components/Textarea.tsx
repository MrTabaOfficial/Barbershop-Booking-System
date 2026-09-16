import { type ComponentProps, useId } from "react";

type TextareaProps = ComponentProps<"textarea"> & { label: string; error?: string };

// Input's multi-line sibling, for descriptions and bios.
export function Textarea({ label, error, id, className = "", ...textareaProps }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div className={className}>
      <label htmlFor={textareaId} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`block w-full rounded-sm border bg-ink px-3 py-2 text-base text-cream placeholder:text-muted ${
          error ? "border-danger" : "border-line-strong hover:border-muted"
        }`}
        {...textareaProps}
      />
      {error && (
        <p id={errorId} className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
