import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import type { SimulationScenarioDTO } from "@finance/shared";
import { resolveSimulatedPaymentMethod, scenarioTypeLabel } from "@finance/shared";
import { formatCurrency, formatShortDateKey } from "../../lib/format";
import { cardClass } from "../dashboard/motion";
import { InfoTip } from "../InfoTip";
import { Switch } from "../Switch";
import type { PlannedCard as CardOption } from "./PlannedPurchaseModal";

interface Props {
  scenario: SimulationScenarioDTO;
  cards: CardOption[];
  currencyCode: string;
  busy?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onBought: () => void;
  onDelete: () => void;
}

function describePayment(scenario: SimulationScenarioDTO, cards: CardOption[], currencyCode: string): string {
  const payload = scenario.payload;
  if (payload.type !== "single_purchase" && payload.type !== "installments") {
    return scenarioTypeLabel(payload.type);
  }
  const method = resolveSimulatedPaymentMethod(payload);
  if (method === "pix" || method === "debit") return "Pix ou débito";
  const card = cards.find((c) => c.id === payload.creditAccountId)?.name ?? "Cartão";
  if (method === "credit_single") return `${card} · à vista`;
  const count = payload.totalInstallments ?? payload.installments ?? 1;
  return `${card} · ${count}x de ${formatCurrency(payload.amount / count, currencyCode)}`;
}

/** Compra planejada: ligada, entra no ciclo da fatura; desligada, fica guardada sem pesar. */
export function PlannedCard({ scenario, cards, currencyCode, busy, onToggle, onEdit, onBought, onDelete }: Props) {
  const active = scenario.status === "active";
  return (
    <article className={`${cardClass} p-4 ${active ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
            <span className="truncate">{scenario.name}</span>
            <InfoTip>
              {scenario.payload.purchaseDate && `Compra em ${formatShortDateKey(scenario.payload.purchaseDate)}. `}
              {active ? "Ligada: já entra no ciclo da fatura." : "Desligada: não pesa no ciclo."}
              {scenario.personName ? ` ${scenario.personName}.` : ""}
            </InfoTip>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{describePayment(scenario, cards, currencyCode)}</p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {formatCurrency(scenario.payload.amount, currencyCode)}
          </p>
        </div>
        <Switch
          checked={active}
          onChange={onToggle}
          disabled={busy}
          label={active ? "Desligar do ciclo" : "Ligar no ciclo"}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border px-2.5 py-1.5 font-medium text-foreground hover:bg-app-bg"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          type="button"
          onClick={onBought}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border px-2.5 py-1.5 font-medium text-foreground hover:bg-app-bg"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Já comprei
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-lg border border-negative/30 px-2.5 py-1.5 font-medium text-negative hover:bg-negative/5"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
      </div>
    </article>
  );
}
