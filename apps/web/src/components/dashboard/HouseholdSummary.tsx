import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { HouseholdCycleSummary, PersonCycleSummary } from "@finance/shared";
import { FinanceSummaryCard, toFinanceMetrics } from "./FinanceSummaryCard";
import { CYCLE_COPY, formatPlainAmount } from "../../lib/cycleLabels";

interface Props {
  household: HouseholdCycleSummary;
  currencyCode: string;
  personFilter?: string;
  showNetWorth: boolean;
  showPerPerson: boolean;
}

function PersonRow({ person, currencyCode }: { person: PersonCycleSummary; currencyCode: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-app-border/50 bg-app-bg/60 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{person.personName}</p>
      <div className="text-right">
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
    </div>
  );
}

/** Patrimônio da casa (ou da pessoa filtrada) e, opcionalmente, o de cada pessoa. */
export function HouseholdSummary({
  household,
  currencyCode,
  personFilter,
  showNetWorth,
  showPerPerson,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const person = personFilter
    ? household.persons.find((p) => p.personId === personFilter)
    : undefined;
  const displayMetrics = person ?? household;

  return (
    <div className="space-y-3">
      {showNetWorth && (
        <FinanceSummaryCard
          title={person?.personName ?? "Casa"}
          metrics={toFinanceMetrics(displayMetrics, {
            isFuture: household.isFuture,
            isComplete: household.isComplete,
          })}
          currencyCode={currencyCode}
          visibleTiles={["netWorth"]}
        />
      )}

      {showPerPerson && household.persons.length > 1 && !personFilter && (
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
              {household.persons.map((p) => (
                <PersonRow key={p.personId} person={p} currencyCode={currencyCode} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
