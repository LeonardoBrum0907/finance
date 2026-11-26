import { useEffect, useRef, type ReactNode } from "react";

const defaultPanelClassName =
  "relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-app-border bg-app-surface p-5 shadow-2xl sm:p-6";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  disableBackdropClose?: boolean;
}

export function Modal({
  onClose,
  children,
  panelClassName = defaultPanelClassName,
  disableBackdropClose = false,
}: ModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (disableBackdropClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disableBackdropClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs"
      onClick={() => {
        if (!disableBackdropClose) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
