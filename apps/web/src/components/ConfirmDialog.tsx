import { AlertTriangle } from "lucide-react";

export type ConfirmVariant = "default" | "danger";

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm rounded-3xl border border-app-border bg-app-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDanger ? "bg-negative/10 text-negative" : "bg-slate-100 text-muted-foreground"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3
              id="confirm-dialog-title"
              className="font-display text-base font-bold text-foreground"
            >
              {title}
            </h3>
            <p id="confirm-dialog-message" className="mt-1 text-sm text-muted-foreground">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-xl border border-app-border bg-app-surface py-2.5 text-xs font-bold text-foreground/90 transition hover:bg-app-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 cursor-pointer rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDanger
                ? "bg-danger hover:bg-danger/90"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
