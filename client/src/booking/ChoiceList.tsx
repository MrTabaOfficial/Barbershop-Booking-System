import type { ReactNode } from "react";

type Choice = {
  id: string;
  title: string;
  description: string | null;
  aside: ReactNode;
};

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
            className="flex w-full items-start justify-between gap-4 rounded-lg bg-surface px-4 py-4 text-left ring-1 ring-inset ring-transparent transition-colors duration-120 ease-standard hover:ring-action active:bg-action-tint sm:px-5"
          >
            <span>
              <span className="block text-lg font-semibold">{choice.title}</span>
              {choice.description && (
                <span className="mt-0.5 block text-sm text-muted">{choice.description}</span>
              )}
            </span>
            <span className="shrink-0 text-right text-sm">{choice.aside}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
