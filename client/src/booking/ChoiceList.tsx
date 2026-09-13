import type { ReactNode } from "react";

type Choice = {
  id: string;
  title: string;
  description: string | null;
  // Shown on the right: the price for a service, the days for a barber.
  aside: ReactNode;
};

// A list of large buttons, one per option. Steps 1 and 2 of the booking
// flow are both "pick one of these", so they share it.
export function ChoiceList({
  choices,
  onChoose,
}: {
  choices: Choice[];
  onChoose: (id: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {choices.map((choice) => (
        <li key={choice.id}>
          <button
            type="button"
            onClick={() => onChoose(choice.id)}
            className="flex w-full items-start justify-between gap-4 rounded-sm border border-line-strong bg-surface p-4 text-left transition-colors hover:border-brass-light sm:p-5"
          >
            <span>
              <span className="block font-display text-xl">{choice.title}</span>
              {choice.description && (
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {choice.description}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right text-sm">{choice.aside}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
