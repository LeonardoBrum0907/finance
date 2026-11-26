import { useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PiggyBank,
  Undo2,
  Wallet,
} from "lucide-react";
import type { BillCycleSummary } from "@finance/shared";
import { formatPlainAmount, toneBorderClass, toneTextClass } from "../../lib/cycleLabels";
import { formatShortDateKey } from "../../lib/format";
import { cardClass } from "../dashboard/motion";
import { CalcValue, type CalcLine, type Calculation } from "../calc/Calculation";

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

/** Período do ciclo: termina no pagamento das faturas, não numa data fixa. */
function cyclePeriodLabel(cycle: BillCycleSummary): string {
  if (!cycle.periodFrom || !cycle.periodTo) return "";
  const range = `Ciclo de ${formatShortDateKey(cycle.periodFrom)} a ${formatShortDateKey(cycle.periodTo)}`;
  if (cycle.paidSource === "manual") return `${range} · marcada como paga`;
  if (cycle.paidSource === "assumed") return `${range} · pagamento não encontrado, considerada paga no vencimento`;
  if (cycle.paidOn) return `${range} · fechou quando a fatura foi paga`;
  return `${range} (previsto) · fecha quando você pagar a fatura`;
}

type CycleMoney = NonNullable<BillCycleSummary["money"]>;

function billCalc(cycle: BillCycleSummary): Calculation {
  const onlyCard = cycle.bills.length === 1;
  const lines: CalcLine[] = cycle.bills.map((bill) => ({
    label: bill.accountName,
    amount: bill.amount,
    op: "+",
    detail: cycle.status !== "paid" && bill.estimated && bill.expected === 0 ? "estimada" : undefined,
    items:
      bill.expected > 0
        ? [
            { label: "Já lançado", amount: bill.charged },
            {
              label: "Previsto",
              amount: bill.expected,
              items: onlyCard
                ? cycle.expectedCardItems.map((item) => ({
                    label: item.title,
                    amount: item.amount,
                    detail: formatShortDateKey(item.date),
                  }))
                : undefined,
            },
          ]
        : undefined,
  }));
  return {
    title: cycle.status === "paid" ? "Fatura" : "Fatura prevista",
    lines,
    result: cycle.billTotal,
    note: `Compras de ${formatShortDateKey(cycle.purchaseFrom)} a ${formatShortDateKey(cycle.purchaseTo)}, vence em ${formatShortDateKey(cycle.dueDate)}.`,
  };
}

function cycleCalcs(
  cycle: BillCycleSummary,
  money: CycleMoney,
  isFirstUnpaid: boolean,
  leftoverLabel: string,
): { available: Calculation; leftover: Calculation } {
  const availableLines: CalcLine[] = [
    { label: isFirstUnpaid ? "Saldo em conta hoje" : "Sobra da fatura anterior", amount: money.startingBalance },
  ];
  if (money.salary > 0) {
    availableLines.push({
      label: "Salário",
      amount: money.salary,
      op: "+",
      detail: money.salaryDate ? formatShortDateKey(money.salaryDate) : undefined,
    });
  }
  if (money.cashItems.length > 0) {
    availableLines.push({
      label: "Contas e Pix até o vencimento",
      amount: money.cashOutflows,
      op: "-",
      items: money.cashItems.map((item) => ({
        label: item.title,
        amount: item.amount,
        detail: formatShortDateKey(item.date),
      })),
    });
  }
  const available: Calculation = {
    title: "Dinheiro para pagar",
    lines: availableLines,
    result: money.available,
    note: money.salaryAfterDue
      ? `O salário de ${formatShortDateKey(money.salaryAfterDue)} cai depois do vencimento e fica para a próxima fatura.`
      : `Pix e débito feitos até ${formatShortDateKey(cycle.dueDate)} saem deste valor.`,
  };
  const bill = billCalc(cycle);
  const leftover: Calculation = {
    title: leftoverLabel,
    lines: [
      { label: "Dinheiro para pagar", amount: money.available, items: availableLines },
      { label: bill.title, amount: cycle.billTotal, op: "-", items: bill.lines },
    ],
    result: money.leftover,
    note:
      cycle.status === "open" || cycle.status === "future"
        ? `É o que cabe em compras novas até o fechamento (${formatShortDateKey(cycle.purchaseTo)}). ${cyclePeriodLabel(cycle)}.`
        : `${cyclePeriodLabel(cycle)}.`,
  };
  return { available, leftover };
}

interface Props {
  cycles: BillCycleSummary[];
  currentCycleKey: string;
  currencyCode: string;
  closingDelta?: number | null;
  /** Fatura escolhida (controlada pela página); sem ela, o card guarda a escolha sozinho. */
  selectedKey?: string | null;
  onSelect?: (cycleKey: string) => void;
  /** "Marcar fatura como paga": sem ele, o botão não aparece (simulador). */
  onMarkPaid?: (cycleKey: string) => void;
  onUnmarkPaid?: (cycleKey: string) => void;
  markingPaid?: boolean;
}

export function BillCycleCard({
  cycles,
  currentCycleKey,
  currencyCode,
  closingDelta,
  selectedKey: controlledKey,
  onSelect,
  onMarkPaid,
  onUnmarkPaid,
  markingPaid = false,
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
  const leftoverLabel = canSpend ? "Ainda posso gastar" : "Sobra depois de pagar";
  const calcs = money ? cycleCalcs(cycle, money, cycle.cycleKey === firstUnpaidKey, leftoverLabel) : null;

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
            Ciclo da fatura
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vence em {formatShortDateKey(cycle.dueDate)}
          </p>
          <BillPaidButton
            cycle={cycle}
            onMarkPaid={onMarkPaid}
            onUnmarkPaid={onUnmarkPaid}
            busy={markingPaid}
          />
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
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {leftoverLabel}
              </p>
              <PiggyBank className={`h-3.5 w-3.5 ${toneTextClass(tone(money.leftover))}`} />
            </div>
            <p className={`font-display text-2xl font-bold tabular-nums ${toneTextClass(tone(money.leftover))}`}>
              <CalcValue calc={calcs!.leftover} currencyCode={currencyCode}>
                {fmt(money.leftover)}
              </CalcValue>
            </p>
            {closingDelta != null && closingDelta !== 0 && (
              <p className={`mt-1 text-xs font-medium ${closingDelta > 0 ? "text-positive" : "text-negative"}`}>
                {closingDelta > 0 ? "+" : ""}
                {fmt(closingDelta)} com a última mudança
              </p>
            )}
          </div>
        )}

        {money && (
          <div className={`rounded-xl border px-4 py-3 ${toneBorderClass("neutral")}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Dinheiro para pagar
              </p>
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="font-display text-xl font-bold tabular-nums text-foreground">
              <CalcValue calc={calcs!.available} currencyCode={currencyCode}>
                {fmt(money.available)}
              </CalcValue>
            </p>
            {money.salaryAfterDue && (
              <p className="mt-1 text-xs font-medium text-negative">
                Salário de {formatShortDateKey(money.salaryAfterDue)} cai depois do vencimento.
              </p>
            )}
          </div>
        )}

        <div className={`rounded-xl border px-4 py-3 ${toneBorderClass("neutral")}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cycle.status === "paid" ? "Fatura" : "Fatura prevista"}
            </p>
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="font-display text-xl font-bold tabular-nums text-foreground">
            <CalcValue calc={billCalc(cycle)} currencyCode={currencyCode}>
              {fmt(cycle.billTotal)}
            </CalcValue>
          </p>
        </div>
      </div>
    </section>
  );
}

function BillPaidButton({
  cycle,
  onMarkPaid,
  onUnmarkPaid,
  busy,
}: {
  cycle: BillCycleSummary;
  onMarkPaid?: (cycleKey: string) => void;
  onUnmarkPaid?: (cycleKey: string) => void;
  busy: boolean;
}) {
  const buttonClass =
    "mt-2 inline-flex items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-app-bg disabled:opacity-50";
  if (cycle.paidSource === "manual" && onUnmarkPaid) {
    return (
      <button type="button" disabled={busy} onClick={() => onUnmarkPaid(cycle.cycleKey)} className={buttonClass}>
        <Undo2 className="h-3.5 w-3.5" />
        Desfazer "paga"
      </button>
    );
  }
  if (cycle.status !== "closed" || !onMarkPaid) return null;
  return (
    <button type="button" disabled={busy} onClick={() => onMarkPaid(cycle.cycleKey)} className={buttonClass}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      Marcar fatura como paga
    </button>
  );
}
