import type { RefObject } from "react";
import type {
  AggregateSimulationImpactDTO,
  CategoryChartSelection,
  CreditAccountSnapshot,
  DashboardPeriodSummary,
  DashboardSummary,
  DashboardWidgetId,
  DashboardWidgetsState,
  HouseholdCycleSummary,
  NavigableCycle,
  SimulatedPurchaseInput,
} from "@finance/shared";
import type { FinanceTileKey } from "./FinanceSummaryCard";
import { HouseholdSummary } from "./HouseholdSummary";
import { isCreditAccount, needsDashboardDetails } from "@finance/shared";
import { CreditCardList } from "./CreditCardList";
import { CycleProgressCard } from "./CycleProgressCard";
import { GrowthChart } from "./GrowthChart";
import { InsightsPanel } from "./InsightsPanel";
import { InvestmentSnapshot } from "./InvestmentSnapshot";
import { RecentTransactions } from "./RecentTransactions";
import { SimulationImpactPanel } from "./SimulationImpactPanel";
import { StatCards } from "./StatCards";
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
  accounts: DashboardSummary["accounts"];
  details?: DashboardSummary;
  detailsFailed: boolean;
  simulationImpact?: AggregateSimulationImpactDTO;
  categorySelection: CategoryChartSelection | null;
  onCategorySelect: (selection: CategoryChartSelection) => void;
  onClearCategorySelection: () => void;
  onSelectCycle: (cycleKey: string) => void;
}

const SUMMARY_TILES: readonly { widget: DashboardWidgetId; tile: FinanceTileKey }[] = [
  { widget: "net-worth", tile: "netWorth" },
  { widget: "still-mine", tile: "stillMine" },
  { widget: "cycle-savings", tile: "saved" },
];

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
  accounts,
  details,
  detailsFailed,
  simulationImpact,
  categorySelection,
  onCategorySelect,
  onClearCategorySelection,
  onSelectCycle,
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

  const visibleTiles = SUMMARY_TILES.filter(({ widget }) => widgets[widget]).map(({ tile }) => tile);
  const showPerPerson = widgets["per-person"];
  const showTransactions = widgets["recent-transactions"];
  const detailsCycle = details?.recentCycles?.find((c) => c.cycleKey === activeCycleKey);

  return (
    <>
      {(visibleTiles.length > 0 || showPerPerson) && (
        <HouseholdSummary
          household={household}
          currencyCode={currencyCode}
          householdPaydayAligned={householdPaydayAligned}
          personFilter={personFilter}
          visibleTiles={visibleTiles}
          showPerPerson={showPerPerson}
        />
      )}
      {widgets["simulation-impact"] && simulationEnabled && simulationImpact && (
        <SimulationImpactPanel
          impact={simulationImpact}
          onAddAnother={showTransactions ? () => onSimulateModalOpenChange(true) : undefined}
        />
      )}
      {needsDashboardDetails(widgets) && !details && (
        <div className="rounded-xl border border-app-border bg-app-surface p-6 text-sm text-muted-foreground">
          {detailsFailed
            ? "Não foi possível carregar alguns blocos. Tente novamente em instantes."
            : "Carregando blocos..."}
        </div>
      )}
      {details && (
        <>
          {widgets["cycle-progress"] &&
            detailsCycle &&
            activeCycleKey &&
            details.paydayDay !== null && (
              <CycleProgressCard
                cycle={detailsCycle}
                cycles={[detailsCycle]}
                currencyCode={details.currencyCode}
                paydayDay={details.paydayDay}
                paydayCycleAnchor={details.paydayCycleAnchor}
                selectedCycleKey={activeCycleKey}
                onSelectCycle={onSelectCycle}
              />
            )}
          {widgets["period-comparison"] && (
            <StatCards
              netWorth={details.netWorth}
              accounts={details.accounts}
              currencyCode={details.currencyCode}
              period={details.period}
              previousPeriod={details.previousPeriod}
              periodMode="payday"
              personId={personFilter}
            />
          )}
          {widgets.investments && (
            <InvestmentSnapshot
              investments={details.investments}
              currencyCode={details.currencyCode}
            />
          )}
          {widgets["spending-evolution"] && (
            <GrowthChart
              data={details.monthlySeries}
              months={1}
              currencyCode={details.currencyCode}
              growthMetrics={details.growthMetrics}
              categories={details.categories}
              previousCategories={details.previousCategories}
              periodLabel={details.period.label}
              periodMode="payday"
              hideIncomeBreakdown={widgets["cycle-progress"]}
              onCategorySelect={showTransactions ? onCategorySelect : undefined}
              personId={personFilter}
              availableNet={details.period.availableNet}
            />
          )}
          {widgets.insights && (
            <InsightsPanel insights={details.insights} personId={personFilter} />
          )}
        </>
      )}
      {widgets["credit-cards"] && accounts.some((acc) => isCreditAccount(acc.type)) && (
        <CreditCardList accounts={accounts} />
      )}
      {showTransactions && (
        <RecentTransactions
          personId={personId}
          dashboardMonths={1}
          periodMode="payday"
          cycleKey={activeCycleKey ?? undefined}
          periodSummary={periodSummary}
          categorySelection={categorySelection}
          onClearCategorySelection={onClearCategorySelection}
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
      )}
    </>
  );
}
