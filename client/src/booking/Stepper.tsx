const STEP_LABELS = ["Service", "Barber", "Time", "Confirm"];

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Booking steps">
      <ol className="grid grid-cols-4 gap-2">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const reached = number <= current;
          return (
            <li
              key={label}
              aria-current={number === current ? "step" : undefined}
              className={`border-t-2 pt-2 ${reached ? "border-brass" : "border-line-strong"}`}
            >
              <span className="block text-xs tabular-nums text-muted">0{number}</span>
              <span
                className={`block text-sm font-semibold ${reached ? "text-cream" : "text-muted"}`}
              >
                {label}
                {number < current && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type Selection = {
  label: string;
  value: string;
  onChange: () => void;
};

export function Selections({ selections }: { selections: Selection[] }) {
  if (selections.length === 0) {
    return null;
  }
  return (
    <dl className="divide-y divide-line border-y border-line">
      {selections.map((selection) => (
        <div key={selection.label} className="flex items-center justify-between gap-4 py-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-muted">
              {selection.label}
            </dt>
            <dd className="mt-0.5">{selection.value}</dd>
          </div>
          <button
            type="button"
            onClick={selection.onChange}
            aria-label={`Change ${selection.label.toLowerCase()}`}
            className="px-2 py-2 text-sm font-medium text-brass-light underline underline-offset-4 hover:text-cream"
          >
            Change
          </button>
        </div>
      ))}
    </dl>
  );
}
