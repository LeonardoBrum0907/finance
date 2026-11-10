import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { HouseholdCycleSummary, PersonCycleSummary } from "@finance/shared";
import { savingsRate, stillMineThisPeriod } from "@finance/shared";
import { FinanceSummaryCard, toFinanceMetrics } from "./FinanceSummaryCard";
import {
  CYCLE_COPY,
  formatCycleBalance,
  formatPlainAmount,
  formatSavingsPercent,
} from "../../lib/cycleLabels";

interface Props {
  household: HouseholdCycleSummary;
  currencyCode: string;
  householdPaydayAligned: boolean;
  personFilter?: string;
}

function PersonRow({
  person,
  currencyCode,
}: {
  person: PersonCycleSummary;
  currencyCode: string;
}) {
  const stillMine = formatCycleBalance(stillMineThisPeriod(person), currencyCode);
  const rate = savingsRate(person);

  return (
    <div className="grid gap-3 rounded-xl border border-app-border/50 bg-app-bg/60 px-4 py-3 sm:grid-cols-4 sm:items-center">
      <p className="text-sm font-medium text-foreground">{person.personName}</p>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {CYCLE_COPY.netWorth}
        </p>
        <p
          className={`text-sm font-semibold ${
            person.netWorth < 0 ? "text-negative" : person.netWorth > 0 ? "text-positive" : "text-foreground"
          }`}
        >
          {formatPlainAmount(person.netWorth, currencyCode)}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {CYCLE_COPY.stillMineThisPeriod}
        </p>
        <p
          className={`text-sm font-semibold ${
            stillMine.tone === "positive"
              ? "text-positive"
              : stillMine.tone === "negative"
                ? "text-negative"
                : "text-foreground"
          }`}
        >
          {stillMine.formattedAmount}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {CYCLE_COPY.savedThisCycle}
        </p>
        <p className="text-sm font-semibold text-foreground">{formatSavingsPercent(rate)}</p>
      </div>
    </div>
  );
}

export function HouseholdSummary({
  household,
  currencyCode,
  householdPaydayAligned,
  personFilter,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const showHouseholdTotals = householdPaydayAligned || household.persons.length === 1;
  const visiblePersons = personFilter
    ? household.persons.filter((p) => p.personId === personFilter)
    : household.persons;
  const displayMetrics =
    personFilter && visiblePersons[0]
      ? visiblePersons[0]
      : showHouseholdTotals
        ? household
        : null;
  const stillMine = stillMineThisPeriod(household);

  return (
    <div className="space-y-3">
      {!householdPaydayAligned && household.persons.length > 1 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          As pessoas têm dias de pagamento diferentes. Veja o detalhamento por pessoa abaixo.
        </div>
      )}

      {stillMine < 0 && (
        <div className="rounded-xl border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">
          Atenção: neste período ainda falta{" "}
          {formatPlainAmount(Math.abs(stillMine), currencyCode)} depois de contas e faturas.
        </div>
      )}

      {displayMetrics && (
        <FinanceSummaryCard
          title={personFilter ? visiblePersons[0]?.personName ?? "Resumo" : "Casa"}
          metrics={toFinanceMetrics(displayMetrics, {
            isFuture: household.isFuture,
            isComplete: household.isComplete,
          })}
          currencyCode={currencyCode}
        />
      )}

      {household.persons.length > 1 && !personFilter && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-app-border/60 bg-app-surface px-4 py-3 text-sm font-medium text-foreground transition hover:bg-app-bg"
          >
            <span>Ver por pessoa ({household.persons.length})</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 pt-2">
              {household.persons.map((person) => (
                <PersonRow key={person.personId} person={person} currencyCode={currencyCode} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
