type SegmentedProps<Value extends string> = {
  label: string;
  options: { value: Value; label: string }[];
  value: Value | null;
  onChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
};

export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: SegmentedProps<Value>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`grid auto-cols-fr grid-flow-col rounded-md border border-edge bg-page p-0.5 ${
        value === null ? "divide-x divide-line" : ""
      } ${className}`}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={chosen}
            disabled={disabled}
            onClick={() => {
              if (!chosen) {
                onChange(option.value);
              }
            }}
            className={`min-h-11 whitespace-nowrap rounded-sm px-2 text-sm transition-colors duration-120 ease-standard disabled:cursor-progress ${
              chosen
                ? "bg-action-tint font-semibold text-action-hover ring-1 ring-inset ring-action"
                : "enabled:hover:bg-action-tint enabled:active:bg-action-tint"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
