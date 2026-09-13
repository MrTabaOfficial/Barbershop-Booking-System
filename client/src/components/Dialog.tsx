import { type ReactNode, useEffect, useId, useRef } from "react";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Buttons, shown at the bottom.
  actions: ReactNode;
};

// A modal dialog built on the browser's own <dialog>. showModal() gives us
// the hard parts for free: focus stays inside, Escape closes, and the page
// behind can't be clicked or read by a screen reader.
//
// Render it only while it should be open:
//   {isOpen && <Dialog ...>}
export function Dialog({ title, onClose, children, actions }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    // Remember what had focus (the button that opened the dialog) and give
    // focus back when the dialog goes away.
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Escape: let the parent decide, so its state stays the source of truth.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself is on the backdrop;
      // clicks on the content land on the inner div.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-sm border border-line-strong bg-surface p-0 text-cream backdrop:bg-black/75"
    >
      {/* Only the middle part scrolls, so the buttons stay in view however
          long the content is. */}
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="overflow-y-auto p-5 sm:p-7">
          <h2 id={titleId} className="text-2xl">
            {title}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed">{children}</div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-line p-5 sm:flex-row sm:justify-end sm:px-7">
          {actions}
        </div>
      </div>
    </dialog>
  );
}
