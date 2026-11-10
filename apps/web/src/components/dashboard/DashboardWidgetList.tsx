import type { RefObject } from "react";
import type {
  CreditAccountSnapshot,
  DashboardPeriodSummary,
  DashboardWidgetsState,
  HouseholdCycleSummary,
  NavigableCycle,
  SimulatedPurchaseInput,
} from "@finance/shared";
import {
  DASHBOARD_WIDGETS,
} from "@finance/shared";
import { HouseholdSummary } from "./HouseholdSummary";
import { RecentTransactions } from "./RecentTransactions";
import type { PersonFilter } from "./PersonSelector";

interface Props {
  widgets: DashboardWidgetsState;
  anyWidgetEnabled: boolean;
  household: HouseholdCycleSummary;
  currencyCode: string;
  householdPaydayAligned: boolean;
  personFilter?: string;
  personId: PersonFilter;
  activeCycleKey: string | null;
  periodSummary?: DashboardPeriodSummary;
  transactionsRef: RefObject<HTMLElement | null>;
  simulationEnabled: boolean;
  simulateModalOpen: boolean;
  onSimulateModalOpenChange: (open: boolean) => void;
  onSaveSimulations: (inputs: SimulatedPurchaseInput[]) => Promise<void>;
  savingSimulation: boolean;
  creditAccounts: CreditAccountSnapshot[];
  selectedCycle?: NavigableCycle;
}

export function DashboardWidgetList({
  widgets,
  anyWidgetEnabled,
  household,
  currencyCode,
  householdPaydayAligned,
  personFilter,
  personId,
  activeCycleKey,
  periodSummary,
  transactionsRef,
  simulationEnabled,
  simulateModalOpen,
  onSimulateModalOpenChange,
  onSaveSimulations,
  savingSimulation,
  creditAccounts,
  selectedCycle,
}: Props) {
  if (!anyWidgetEnabled) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-10 text-center">
        <p className="text-sm font-medium text-foreground/90">Nenhum bloco ativo no painel</p>
        <p className="mt-1 text-sm text-muted-foreground-dark">
          Ative os blocos que você quer ver em{" "}
          <a href="/configuracoes" className="font-medium text-brand underline">
            Configurações
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {DASHBOARD_WIDGETS.map((widget) => {
        if (!widgets[widget.id]) return null;
        if (widget.id === "household-summary") {
          return (
            <HouseholdSummary
              key={widget.id}
              household={household}
              currencyCode={currencyCode}
              householdPaydayAligned={householdPaydayAligned}
              personFilter={personFilter}
            />
          );
        }
        if (widget.id === "recent-transactions") {
          return (
            <RecentTransactions
              key={widget.id}
              personId={personId}
              dashboardMonths={1}
              periodMode="payday"
              cycleKey={activeCycleKey ?? undefined}
              periodSummary={periodSummary}
              categorySelection={null}
              onClearCategorySelection={() => {}}
              sectionRef={transactionsRef}
              simulationEnabled={simulationEnabled}
              simulateModalOpen={simulateModalOpen}
              onSimulateModalOpenChange={onSimulateModalOpenChange}
              onSaveSimulations={onSaveSimulations}
              savingSimulation={savingSimulation}
              creditAccounts={creditAccounts}
              bankBalance={household.bankBalance}
              currentCycle={
                selectedCycle
                  ? {
                      from: selectedCycle.from,
                      to: selectedCycle.to,
                      cycleKey: selectedCycle.cycleKey,
                    }
                  : undefined
              }
            />
          );
        }
        return null;
      })}
    </>
  );
}
