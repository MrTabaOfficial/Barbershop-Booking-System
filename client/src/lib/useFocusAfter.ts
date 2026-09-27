import { useEffect, useState } from "react";

// The button that starts a cancel or a removal disappears when the list
// reloads, which would drop keyboard focus to the top of the page.
export function useFocusAfter<Subject>(
  hasHappened: (subject: Subject) => boolean,
  target: (subject: Subject) => HTMLElement | null | undefined,
): (subject: Subject) => void {
  const [subject, setSubject] = useState<Subject | null>(null);

  useEffect(() => {
    if (subject !== null && hasHappened(subject)) {
      target(subject)?.focus();
      setSubject(null);
    }
  });

  return setSubject;
}
