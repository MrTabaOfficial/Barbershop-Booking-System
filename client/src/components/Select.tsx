import { type ComponentProps, useId } from "react";

type SelectProps = ComponentProps<"select"> & { label: string };

export function Select({ label, id, className = "", children, ...selectProps }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        className="block min-h-11 w-full rounded-md border border-edge bg-page px-3 py-2 text-base text-ink transition-colors duration-120 ease-standard hover:border-ink"
        {...selectProps}
      >
        {children}
      </select>
    </div>
  );
}
