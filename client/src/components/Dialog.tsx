import { type ReactNode, useEffect, useId, useRef } from "react";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
};

export function Dialog({ title, onClose, children, actions }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-sm border border-line-strong bg-surface p-0 text-cream backdrop:bg-black/75"
    >
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
