export type Step = {
  label: string;
  choice?: string | [string, string];
  onChange?: () => void;
};

export function Stepper({ current, steps }: { current: number; steps: Step[] }) {
  return (
    <nav aria-label="Booking steps">
      <ol className="grid grid-cols-4 gap-1.5 lg:gap-2.5">
        {steps.map((step, index) => {
          const number = index + 1;
          const isCurrent = number === current;
          const isDone = number < current;
          const choiceLines = typeof step.choice === "string" ? [step.choice] : (step.choice ?? []);
          const content = (
            <>
              <span
                className={`block ${isCurrent ? "font-extrabold text-ink" : "text-muted"}`}
              >
                <span className="mr-1 tabular-nums">{number}</span>
                {step.label}
                {isDone && <span className="sr-only"> (done)</span>}
              </span>
              {step.choice && (
                <span className="block break-words font-semibold text-action underline underline-offset-2 transition-colors duration-120 ease-standard group-hover:text-action-pressed">
                  {choiceLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              )}
            </>
          );
          return (
            <li
              key={step.label}
              aria-current={isCurrent ? "step" : undefined}
              className={`border-t-4 text-sm lg:text-base ${
                isCurrent ? "border-action" : isDone ? "border-ink" : "border-line"
              }`}
            >
              {step.choice && step.onChange ? (
                <button
                  type="button"
                  onClick={step.onChange}
                  aria-label={`Change ${step.label.toLowerCase()}, now ${choiceLines.join(", ")}`}
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
