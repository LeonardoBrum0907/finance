import type { ReactNode } from "react";

const defaultPanelClassName =
  "relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-app-border bg-app-surface p-6 shadow-2xl";

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
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
