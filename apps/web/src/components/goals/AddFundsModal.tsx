import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { GoalDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { Modal } from "../Modal";

interface Props {
  goal: GoalDTO | null;
  currencyCode: string;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { id: string; amount: number; note?: string }) => void;
}

export function AddFundsModal({ goal, currencyCode, saving, onClose, onSave }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (goal) {
      setAmount("");
      setNote("");
    }
  }, [goal]);

  if (!goal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return;
    onSave({ id: goal.id, amount: value, note: note.trim() || undefined });
  };

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <Modal
      onClose={onClose}
      disableBackdropClose={saving}
      panelClassName="relative w-full max-w-md rounded-3xl border border-app-border bg-app-surface p-6 shadow-2xl"
    >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-foreground">Adicionar Fundos</h3>
        <p className="mb-1 text-sm text-muted-foreground">{goal.name}</p>
        <p className="mb-6 text-xs text-muted-foreground">
          Faltam {formatCurrency(remaining, currencyCode)} para atingir a meta.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fund-amount" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Valor (R$)
            </label>
            <input
              id="fund-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground outline-brand focus:border-brand focus:bg-app-surface"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fund-note" className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Nota (opcional)
            </label>
            <input
              id="fund-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Bônus do trabalho"
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full cursor-pointer rounded-xl bg-brand py-3 text-xs font-bold text-white shadow-md hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Registrando..." : "Registrar aporte"}
          </button>
        </form>
    </Modal>
  );
}
