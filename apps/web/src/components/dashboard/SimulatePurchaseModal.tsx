import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import {
  buildInstallmentSchedule,
  computeCreditBillImpacts,
  computeSimulationCycleImpact,
  createSimulatedPurchase,
  FINE_GRAINED_CATEGORIES,
  paymentMethodLabel,
  simulatedPurchaseInputSchema,
  todayDateKeyInTimeZone,
  type CreditAccountSnapshot,
  type SimulatedPaymentMethod,
  type SimulatedPurchase,
  type SimulatedPurchaseInput,
} from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { Modal } from "../Modal";

interface Props {
  open: boolean;
  currencyCode: string;
  creditAccounts: CreditAccountSnapshot[];
  bankBalance?: number;
  currentCycle: { from: string; to: string; cycleKey: string };
  onClose: () => void;
  onSave: (inputs: SimulatedPurchaseInput[]) => Promise<void>;
  saving?: boolean;
}

type AmountMode = "total" | "installment";

const PAYMENT_OPTIONS: {
  value: SimulatedPaymentMethod;
  label: string;
  requiresCredit?: boolean;
}[] = [
  { value: "pix", label: "PIX / débito" },
  { value: "credit_single", label: "Crédito à vista", requiresCredit: true },
  { value: "credit_installments", label: "Crédito parcelado", requiresCredit: true },
];

export function SimulatePurchaseModal({
  open,
  currencyCode,
  creditAccounts,
  bankBalance,
  currentCycle,
  onClose,
  onSave,
  saving = false,
}: Props) {
  const hasCreditCards = creditAccounts.length > 0;
  const availableMethods = PAYMENT_OPTIONS.filter((o) => !o.requiresCredit || hasCreditCards);

  const [paymentMethod, setPaymentMethod] = useState<SimulatedPaymentMethod>("pix");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amountMode, setAmountMode] = useState<AmountMode>("total");
  const [amountInput, setAmountInput] = useState("");
  const [installments, setInstallments] = useState("3");
  const [purchaseDate, setPurchaseDate] = useState(() => todayDateKeyInTimeZone());
  const [firstDueDate, setFirstDueDate] = useState(() => todayDateKeyInTimeZone());
  const [creditAccountId, setCreditAccountId] = useState(creditAccounts[0]?.id ?? "");
  const [showSchedule, setShowSchedule] = useState(false);
  const [pendingPurchases, setPendingPurchases] = useState<SimulatedPurchase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod("pix");
    setTitle("");
    setCategory("");
    setAmountMode("total");
    setAmountInput("");
    setInstallments("3");
    setPurchaseDate(todayDateKeyInTimeZone());
    setFirstDueDate(todayDateKeyInTimeZone());
    setCreditAccountId(creditAccounts[0]?.id ?? "");
    setShowSchedule(false);
    setPendingPurchases([]);
    setError(null);
  }, [open, creditAccounts]);

  const parsedAmount = parseFloat(amountInput.replace(",", "."));
  const parsedInstallments = parseInt(installments, 10);
  const isInstallments = paymentMethod === "credit_installments";
  const today = todayDateKeyInTimeZone();

  const totalAmount = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    if (!isInstallments) return parsedAmount;
    if (!Number.isFinite(parsedInstallments) || parsedInstallments < 2) return null;
    if (amountMode === "total") return parsedAmount;
    return Math.round(parsedAmount * parsedInstallments * 100) / 100;
  }, [amountMode, isInstallments, parsedAmount, parsedInstallments]);

  const previewSchedule = useMemo(() => {
    if (totalAmount === null) return [];
    if (!isInstallments) {
      return [{ dueDate: purchaseDate, amount: totalAmount }];
    }
    return buildInstallmentSchedule({
      totalAmount,
      totalInstallments: parsedInstallments,
      firstDueDate,
    });
  }, [totalAmount, isInstallments, parsedInstallments, firstDueDate, purchaseDate]);

  const installmentPreview = previewSchedule[0]?.amount ?? null;

  const previewInput = useMemo(() => {
    if (totalAmount === null || !title.trim()) return null;
    const base = {
      title: title.trim(),
      category: category || undefined,
      paymentMethod,
      totalAmount,
      purchaseDate,
      creditAccountId:
        paymentMethod === "credit_single" || paymentMethod === "credit_installments"
          ? creditAccountId
          : undefined,
      totalInstallments: isInstallments ? parsedInstallments : undefined,
      firstDueDate: isInstallments ? firstDueDate : undefined,
    };
    const parsed = simulatedPurchaseInputSchema.safeParse(base);
    if (!parsed.success) return null;
    return createSimulatedPurchase(parsed.data, "preview");
  }, [
    totalAmount,
    title,
    category,
    paymentMethod,
    purchaseDate,
    creditAccountId,
    isInstallments,
    parsedInstallments,
    firstDueDate,
  ]);

  const allPreviewPurchases = useMemo(
    () => [...pendingPurchases, ...(previewInput ? [previewInput] : [])],
    [pendingPurchases, previewInput],
  );

  const cyclePreview = useMemo(() => {
    if (allPreviewPurchases.length === 0) return null;
    return computeSimulationCycleImpact(
      allPreviewPurchases,
      { from: currentCycle.from, to: currentCycle.to },
      today,
    );
  }, [allPreviewPurchases, currentCycle.from, currentCycle.to, today]);

  const creditPreview = useMemo(() => {
    if (allPreviewPurchases.length === 0 || creditAccounts.length === 0) return [];
    return computeCreditBillImpacts(allPreviewPurchases, creditAccounts, today);
  }, [allPreviewPurchases, creditAccounts, today]);

  const pixWarning = useMemo(() => {
    if (paymentMethod !== "pix" && paymentMethod !== "debit") return null;
    if (totalAmount == null || bankBalance == null) return null;
    if (totalAmount > bankBalance) {
      return `Saldo atual insuficiente (faltam ${formatCurrency(totalAmount - bankBalance, currencyCode)}).`;
    }
    return null;
  }, [paymentMethod, totalAmount, bankBalance, currencyCode]);

  if (!open) return null;

  const buildInput = () => {
    if (totalAmount === null) {
      setError("Informe um valor válido.");
      return null;
    }
    const parsed = simulatedPurchaseInputSchema.safeParse({
      title,
      category: category || undefined,
      paymentMethod,
      totalAmount,
      purchaseDate,
      creditAccountId:
        paymentMethod === "credit_single" || paymentMethod === "credit_installments"
          ? creditAccountId
          : undefined,
      totalInstallments: isInstallments ? parsedInstallments : undefined,
      firstDueDate: isInstallments ? firstDueDate : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return null;
    }
    return parsed.data;
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setAmountInput("");
    setInstallments("3");
    setPurchaseDate(todayDateKeyInTimeZone());
    setFirstDueDate(todayDateKeyInTimeZone());
    setError(null);
  };

  const handleAddToQueue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;
    setPendingPurchases((prev) => [...prev, createSimulatedPurchase(input)]);
    resetForm();
  };

  const handleConclude = async () => {
    setError(null);
    const inputs: SimulatedPurchaseInput[] = [];
    for (const purchase of pendingPurchases) {
      inputs.push({
        title: purchase.title,
        category: purchase.category,
        paymentMethod: purchase.paymentMethod,
        totalAmount: purchase.totalAmount,
        purchaseDate: purchase.purchaseDate,
        creditAccountId: purchase.creditAccountId,
        totalInstallments:
          purchase.paymentMethod === "credit_installments"
            ? purchase.installments.length
            : undefined,
        firstDueDate:
          purchase.paymentMethod === "credit_installments"
            ? purchase.installments[0]?.dueDate
            : undefined,
        interestRate: purchase.interestRate,
      });
    }
    const current = buildInput();
    if (current) inputs.push(current);
    if (inputs.length === 0) {
      setError("Adicione ao menos uma compra.");
      return;
    }
    try {
      await onSave(inputs);
      onClose();
    } catch {
      setError("Não foi possível salvar no simulador.");
    }
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
        Nada é salvo permanentemente. Veja o impacto no ciclo e na fatura antes de decidir.
      </p>

      {pendingPurchases.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Na fila ({pendingPurchases.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {pendingPurchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-amber-900">
                <span className="truncate">
                  {p.title} · {paymentMethodLabel(p.paymentMethod)} ·{" "}
                  {formatCurrency(p.totalAmount, currencyCode)}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingPurchases((prev) => prev.filter((x) => x.id !== p.id))}
                  className="shrink-0 rounded p-0.5 hover:bg-amber-100"
                  aria-label="Remover da fila"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleAddToQueue} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Forma de pagamento
          </span>
          <div className="flex flex-wrap gap-2">
            {availableMethods.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentMethod(opt.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  paymentMethod === opt.value
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-app-border text-muted-foreground hover:bg-app-bg"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="sim-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Descrição
          </label>
          <input
            id="sim-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Tênis, mercado..."
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

        {(paymentMethod === "credit_single" || paymentMethod === "credit_installments") && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sim-card" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Cartão
            </label>
            <select
              id="sim-card"
              value={creditAccountId}
              onChange={(e) => setCreditAccountId(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
              required
            >
              {creditAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isInstallments && (
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
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sim-amount" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isInstallments && amountMode === "installment" ? "Valor da parcela (R$)" : "Valor (R$)"}
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
            <label htmlFor="sim-date" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Data da compra
            </label>
            <input
              id="sim-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
              required
            />
          </div>
        </div>

        {isInstallments && (
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sim-first-due" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Data da 1ª parcela
              </label>
              <input
                id="sim-first-due"
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                className="w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:bg-app-surface"
                required
              />
            </div>
          </div>
        )}

        {installmentPreview !== null && totalAmount !== null && isInstallments && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            {parsedInstallments}x de {formatCurrency(installmentPreview, currencyCode)}
            {amountMode === "installment" && (
              <> · total {formatCurrency(totalAmount, currencyCode)}</>
            )}
            {previewSchedule.length > 1 && (
              <>
                {" "}
                · última em{" "}
                {previewSchedule[previewSchedule.length - 1]!.dueDate.slice(5).replace("-", "/")}
              </>
            )}
          </div>
        )}

        {(paymentMethod === "pix" || paymentMethod === "debit") && totalAmount !== null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            Saída imediata de {formatCurrency(totalAmount, currencyCode)} em{" "}
            {purchaseDate.slice(5).replace("-", "/")}
          </div>
        )}

        {pixWarning && (
          <p className="rounded-lg border border-danger-border bg-danger-muted px-3 py-2 text-xs text-danger">
            {pixWarning}
          </p>
        )}

        {(cyclePreview || creditPreview.length > 0) && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-950">
            <p className="font-semibold">Preview de impacto</p>
            {cyclePreview && (cyclePreview.realizedExpenses > 0 || cyclePreview.committedExpenses > 0) && (
              <p className="mt-1">
                Ciclo {currentCycle.cycleKey}:{" "}
                {cyclePreview.realizedExpenses > 0 && (
                  <span>−{formatCurrency(cyclePreview.realizedExpenses, currencyCode)} realizado</span>
                )}
                {cyclePreview.realizedExpenses > 0 && cyclePreview.committedExpenses > 0 && " · "}
                {cyclePreview.committedExpenses > 0 && (
                  <span>−{formatCurrency(cyclePreview.committedExpenses, currencyCode)} comprometido</span>
                )}
              </p>
            )}
            {creditPreview.map((impact) =>
              impact.openBillAfter !== impact.openBillBefore ? (
                <p key={impact.accountId} className="mt-1">
                  Fatura {impact.accountName}: {formatCurrency(impact.openBillBefore, currencyCode)} →{" "}
                  {formatCurrency(impact.openBillAfter, currencyCode)}
                </p>
              ) : null,
            )}
          </div>
        )}

        {isInstallments && previewSchedule.length > 1 && (
          <div>
            <button
              type="button"
              onClick={() => setShowSchedule((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showSchedule ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Ver todas as parcelas
            </button>
            {showSchedule && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {previewSchedule.map((inst, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {i + 1}/{previewSchedule.length} · {inst.dueDate.slice(5).replace("-", "/")}
                    </span>
                    <span>{formatCurrency(inst.amount, currencyCode)}</span>
                  </li>
                ))}
              </ul>
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
            className="flex-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Adicionar outra
          </button>
          <button
            type="button"
            onClick={() => void handleConclude()}
            disabled={saving}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar no simulador"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
