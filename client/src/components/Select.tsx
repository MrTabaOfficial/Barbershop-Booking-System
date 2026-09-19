import { type ComponentProps, useId } from "react";

type SelectProps = ComponentProps<"select"> & { label: string };

export function Select({ label, id, className = "", children, ...selectProps }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <select
        id={selectId}
        className="block min-h-11 w-full rounded-sm border border-line-strong bg-ink px-3 py-2 text-base text-cream hover:border-muted"
        {...selectProps}
      >
        {children}
      </select>
    </div>
  );
}
