import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  buildInstallmentSchedule,
  createSimulatedPurchase,
  FINE_GRAINED_CATEGORIES,
  simulatedPurchaseInputSchema,
  todayDateKeyInTimeZone,
  type SimulatedPurchase,
} from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { Modal } from "../Modal";

interface Props {
  open: boolean;
  currencyCode: string;
  onClose: () => void;
  onAdd: (purchase: SimulatedPurchase) => void;
}

type AmountMode = "total" | "installment";

export function SimulatePurchaseModal({ open, currencyCode, onClose, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amountMode, setAmountMode] = useState<AmountMode>("total");
  const [amountInput, setAmountInput] = useState("");
  const [installments, setInstallments] = useState("3");
  const [firstDueDate, setFirstDueDate] = useState(() => todayDateKeyInTimeZone());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCategory("");
    setAmountMode("total");
    setAmountInput("");
    setInstallments("3");
    setFirstDueDate(todayDateKeyInTimeZone());
    setError(null);
  }, [open]);

  const parsedAmount = parseFloat(amountInput.replace(",", "."));
  const parsedInstallments = parseInt(installments, 10);

  const totalAmount = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    if (!Number.isFinite(parsedInstallments) || parsedInstallments < 2) return null;
    if (amountMode === "total") return parsedAmount;
    return Math.round(parsedAmount * parsedInstallments * 100) / 100;
  }, [amountMode, parsedAmount, parsedInstallments]);

  const previewSchedule = useMemo(() => {
    if (totalAmount === null) return [];
    return buildInstallmentSchedule({
      totalAmount,
      totalInstallments: parsedInstallments,
      firstDueDate,
    });
  }, [totalAmount, parsedInstallments, firstDueDate]);

  const installmentPreview = previewSchedule[0]?.amount ?? null;

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (totalAmount === null) {
      setError("Informe um valor válido.");
      return;
    }

    const parsed = simulatedPurchaseInputSchema.safeParse({
      title,
      category: category || undefined,
      totalAmount,
      totalInstallments: parsedInstallments,
      firstDueDate,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    onAdd(createSimulatedPurchase(parsed.data));
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      <h3 className="mb-1 font-display text-lg font-bold text-foreground">Simular compra</h3>
      <p className="mb-5 text-sm text-muted-foreground">
        Parcelas simuladas afetam o ciclo atual. Nada é salvo permanentemente.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sim-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Descrição
          </label>
          <input
            id="sim-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Bota"
            className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="sim-category" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Categoria (opcional)
          </label>
          <select
            id="sim-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
          >
            <option value="">Sem categoria</option>
            {FINE_GRAINED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAmountMode("total")}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              amountMode === "total"
                ? "border-brand bg-brand/10 text-brand"
                : "border-app-border text-muted-foreground hover:bg-app-bg"
            }`}
          >
            Valor total
          </button>
          <button
            type="button"
            onClick={() => setAmountMode("installment")}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              amountMode === "installment"
                ? "border-brand bg-brand/10 text-brand"
                : "border-app-border text-muted-foreground hover:bg-app-bg"
            }`}
          >
            Valor da parcela
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sim-amount" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {amountMode === "total" ? "Valor total (R$)" : "Valor da parcela (R$)"}
            </label>
            <input
              id="sim-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sim-installments" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Parcelas
            </label>
            <input
              id="sim-installments"
              type="number"
              min={2}
              max={48}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="sim-date" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Data da 1ª parcela
          </label>
          <input
            id="sim-date"
            type="date"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
            className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
            required
          />
        </div>

        {installmentPreview !== null && totalAmount !== null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            {parsedInstallments}x de {formatCurrency(installmentPreview, currencyCode)}
            {amountMode === "installment" && (
              <> · total {formatCurrency(totalAmount, currencyCode)}</>
            )}
            {previewSchedule.length > 1 && (
              <> · última em {previewSchedule[previewSchedule.length - 1]!.dueDate.slice(5).replace("-", "/")}</>
            )}
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-app-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-app-bg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Adicionar simulação
          </button>
        </div>
      </form>
    </Modal>
  );
}
