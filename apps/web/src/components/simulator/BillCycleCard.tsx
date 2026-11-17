import { useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, PiggyBank, Wallet } from "lucide-react";
import type { BillCycleSummary } from "@finance/shared";
import { formatPlainAmount, toneBorderClass, toneTextClass } from "../../lib/cycleLabels";
import { formatShortDateKey } from "../../lib/format";
import { cardClass } from "../dashboard/motion";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function billCycleLabel(cycleKey: string): string {
  const [year, month] = cycleKey.split("-").map(Number);
  return `Fatura de ${MONTHS[month! - 1]} ${year}`;
}

function statusLabel(cycle: BillCycleSummary, isCurrent: boolean): string {
  if (cycle.status === "paid") return "Fatura paga";
  if (cycle.status === "closed") return "Fatura fechada · a pagar";
  if (isCurrent || cycle.status === "open") return "Ciclo atual";
  return "Projeção";
}

function tone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

interface Props {
  cycles: BillCycleSummary[];
  currentCycleKey: string;
  currencyCode: string;
  closingDelta?: number | null;
  /** Fatura escolhida (controlada pela página); sem ela, o card guarda a escolha sozinho. */
  selectedKey?: string | null;
  onSelect?: (cycleKey: string) => void;
}

export function BillCycleCard({
  cycles,
  currentCycleKey,
  currencyCode,
  closingDelta,
  selectedKey: controlledKey,
  onSelect,
}: Props) {
  const [localKey, setLocalKey] = useState<string | null>(null);
  const selectedKey = controlledKey !== undefined ? controlledKey : localKey;
  const setSelectedKey = (key: string) => (onSelect ? onSelect(key) : setLocalKey(key));
  const activeKey = selectedKey ?? currentCycleKey;
  const index = Math.max(
    0,
    cycles.findIndex((c) => c.cycleKey === activeKey),
  );
  const cycle = cycles[index];
  if (!cycle) return null;

  const money = cycle.money;
  const firstUnpaidKey = cycles.find((c) => c.money)?.cycleKey;
  const fmt = (value: number) => formatPlainAmount(value, currencyCode);
  const canSpend = cycle.status === "open" || cycle.status === "future";
  const leftoverLabel = canSpend ? "Ainda posso gastar no cartão" : "Sobra depois de pagar";

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">Ciclo da fatura</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compras de {formatShortDateKey(cycle.purchaseFrom)} a{" "}
            {formatShortDateKey(cycle.purchaseTo)} · vence em {formatShortDateKey(cycle.dueDate)}
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg p-1"
          role="group"
          aria-label="Navegar entre faturas"
        >
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => setSelectedKey(cycles[index - 1]!.cycleKey)}
            className="rounded-md p-1.5 text-muted-foreground-dark transition hover:bg-app-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Fatura anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[11rem] px-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {statusLabel(cycle, cycle.cycleKey === currentCycleKey)}
            </p>
            <p className="text-sm font-medium text-foreground">{billCycleLabel(cycle.cycleKey)}</p>
          </div>
          <button
            type="button"
            disabled={index >= cycles.length - 1}
            onClick={() => setSelectedKey(cycles[index + 1]!.cycleKey)}
            className="rounded-md p-1.5 text-muted-foreground-dark transition hover:bg-app-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Próxima fatura"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${money ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
        {money && (
          <div className={`rounded-xl border px-4 py-3 ${toneBorderClass(tone(money.leftover))}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {leftoverLabel}
              </p>
              <PiggyBank className={`h-3.5 w-3.5 ${toneTextClass(tone(money.leftover))}`} />
            </div>
            <p className={`font-display text-2xl font-bold tabular-nums ${toneTextClass(tone(money.leftover))}`}>
              {fmt(money.leftover)}
            </p>
            {closingDelta != null && closingDelta !== 0 && (
              <p className={`mt-1 text-xs font-medium ${closingDelta > 0 ? "text-positive" : "text-negative"}`}>
                {closingDelta > 0 ? "+" : ""}
                {fmt(closingDelta)} ao desligar conta
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Dinheiro para a fatura {fmt(money.available)} − fatura prevista {fmt(cycle.billTotal)}
            </p>
            {canSpend && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                É o que cabe em compras novas até o fechamento ({formatShortDateKey(cycle.purchaseTo)}).
              </p>
            )}
          </div>
        )}

        {money && (
          <div className={`rounded-xl border px-4 py-3 ${toneBorderClass("neutral")}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Dinheiro para pagar a fatura
              </p>
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="font-display text-xl font-bold tabular-nums text-foreground">
              {fmt(money.available)}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <li>
                {cycle.cycleKey === firstUnpaidKey ? "Saldo em conta hoje" : "Sobra da fatura anterior"}
                : {fmt(money.startingBalance)}
              </li>
              {money.salary > 0 && (
                <li>
                  + Salário {money.salaryDate ? `de ${formatShortDateKey(money.salaryDate)}` : ""}:{" "}
                  {fmt(money.salary)}
                </li>
              )}
              {money.cashItems.map((item) => (
                <li key={item.id}>
                  − {item.title} ({formatShortDateKey(item.date)}): {fmt(item.amount)}
                </li>
              ))}
            </ul>
            {money.salaryAfterDue && (
              <p className="mt-1 text-xs font-medium text-negative">
                O salário de {formatShortDateKey(money.salaryAfterDue)} cai depois do vencimento e não
                ajuda a pagar esta fatura.
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pix e débito feitos até o vencimento saem deste valor.
            </p>
          </div>
        )}

        <div className={`rounded-xl border px-4 py-3 ${toneBorderClass("neutral")}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cycle.status === "paid" ? "Fatura" : "Fatura prevista"}
            </p>
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="font-display text-xl font-bold tabular-nums text-foreground">
            {fmt(cycle.billTotal)}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {cycle.bills.map((bill) => (
              <li key={bill.accountId}>
                {bill.accountName}: {fmt(bill.amount)}
                {bill.expected > 0 && ` (${fmt(bill.charged)} lançados + ${fmt(bill.expected)} previstos)`}
                {cycle.status !== "paid" && bill.estimated && bill.expected === 0 && " · estimada"}
              </li>
            ))}
          </ul>
          {cycle.expectedCardItems.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Previstos: {cycle.expectedCardItems.map((item) => item.title).join(", ")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
