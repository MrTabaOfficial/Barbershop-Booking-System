export type Step = {
  label: string;
  choice?: string;
  onChange?: () => void;
};

export function Stepper({ current, steps }: { current: number; steps: Step[] }) {
  return (
    <nav aria-label="Booking steps">
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const number = index + 1;
          const reached = number <= current;
          const content = (
            <>
              <span className="block text-xs tabular-nums text-muted">0{number}</span>
              <span
                className={`block text-sm font-semibold ${reached ? "text-cream" : "text-muted"}`}
              >
                {step.label}
                {number < current && <span className="sr-only"> (done)</span>}
              </span>
              {step.choice && (
                <span className="mt-0.5 block break-words text-xs text-brass-light underline underline-offset-2 group-hover:text-cream">
                  {step.choice}
                </span>
              )}
            </>
          );
          return (
            <li
              key={step.label}
              aria-current={number === current ? "step" : undefined}
              className={`border-t-2 ${reached ? "border-brass" : "border-line-strong"}`}
            >
              {step.choice && step.onChange ? (
                <button
                  type="button"
                  onClick={step.onChange}
                  aria-label={`Change ${step.label.toLowerCase()}, now ${step.choice}`}
                  className="group block w-full pb-1 pt-2 text-left"
                >
                  {content}
                </button>
              ) : (
                <div className="pt-2">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
