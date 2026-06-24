import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AvailableGoalSourceDTO, GoalType } from "@finance/shared";
import {
  GoalSourceSelector,
  previewAllocatedTotal,
  type GoalSourceSelection,
} from "./GoalSourceSelector";
import { formatCurrency } from "../../lib/format";

interface Props {
  open: boolean;
  saving: boolean;
  availableSources: AvailableGoalSourceDTO[];
  currencyCode?: string;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    type: GoalType;
    targetAmount: number;
    targetDate?: string;
    sources?: GoalSourceSelection[];
  }) => void;
}

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "savings", label: "Poupança" },
  { value: "purchase", label: "Compra" },
  { value: "debt_payoff", label: "Quitar dívida" },
  { value: "emergency_fund", label: "Reserva de emergência" },
  { value: "custom", label: "Personalizado" },
];

export function CreateGoalModal({
  open,
  saving,
  availableSources,
  currencyCode = "BRL",
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GoalType>("savings");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [useAuto, setUseAuto] = useState(true);
  const [sources, setSources] = useState<GoalSourceSelection[]>([]);

  const handleSourcesChange = useCallback((next: GoalSourceSelection[]) => {
    setSources(next);
  }, []);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setType("savings");
      setTargetAmount("");
      setTargetDate("");
      setSources([]);
      const hasSources = availableSources.some(
        (s) => !s.isCredit && s.availablePercent > 0,
      );
      setUseAuto(hasSources);
    }
  }, [open, availableSources]);

  if (!open) return null;

  const previewTotal = previewAllocatedTotal(sources, availableSources);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(targetAmount);
    if (!name.trim() || isNaN(amount) || amount <= 0) return;
    if (useAuto && sources.length === 0) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      targetAmount: amount,
      targetDate: targetDate || undefined,
      sources: useAuto ? sources : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-slate-400 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <h3 className="mb-1 font-display text-lg font-bold text-slate-900">Novo Objetivo</h3>
        <p className="mb-6 font-sans text-xs text-slate-400">
          Defina a meta e, se quiser, vincule contas ou investimentos para acompanhar automaticamente.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-name" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Nome
            </label>
            <input
              id="goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Viagem para Europa"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 outline-emerald-400 focus:border-emerald-400 focus:bg-white"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-type" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Tipo
            </label>
            <select
              id="goal-type"
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
            >
              {GOAL_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-amount" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Valor alvo (R$)
            </label>
            <input
              id="goal-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-date" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Prazo (opcional)
            </label>
            <input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-desc" className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Descrição (opcional)
            </label>
            <textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={useAuto}
                onChange={(e) => setUseAuto(e.target.checked)}
              />
              Acompanhar automaticamente por saldo vinculado
            </label>
            {useAuto && (
              <div className="mt-3">
                <GoalSourceSelector
                  availableSources={availableSources}
                  currencyCode={currencyCode}
                  onChange={handleSourcesChange}
                />
                {sources.length > 0 && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Progresso inicial estimado:{" "}
                    <strong>{formatCurrency(previewTotal, currencyCode)}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || (useAuto && sources.length === 0)}
            className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Criando..." : useAuto ? "Criar objetivo automático" : "Criar objetivo manual"}
          </button>
        </form>
      </div>
    </div>
  );
}
