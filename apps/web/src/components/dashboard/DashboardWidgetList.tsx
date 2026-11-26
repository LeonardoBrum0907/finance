import type { DashboardSummary, DashboardWidgetsState, HouseholdCycleSummary } from "@finance/shared";
import { isCreditAccount, needsDashboardDetails } from "@finance/shared";
import { HouseholdSummary } from "./HouseholdSummary";
import { CreditCardList } from "./CreditCardList";
import { InvestmentSnapshot } from "./InvestmentSnapshot";
import { RecentTransactions } from "./RecentTransactions";
import type { PersonFilter } from "./PersonSelector";

interface Props {
  /** Já sem os blocos de módulos desligados. */
  widgets: DashboardWidgetsState;
  household: HouseholdCycleSummary;
  currencyCode: string;
  personFilter?: string;
  personId: PersonFilter;
  activeCycleKey: string | null;
  /** Fatura escolhida no card "Ciclo da fatura" (AAAA-MM). */
  billCycleKey?: string | null;
  accounts: DashboardSummary["accounts"];
  details?: DashboardSummary;
  detailsFailed: boolean;
}

/** Blocos opcionais do Início, abaixo do card do ciclo da fatura. */
export function DashboardWidgetList({
  widgets,
  household,
  currencyCode,
  personFilter,
  personId,
  activeCycleKey,
  billCycleKey,
  accounts,
  details,
  detailsFailed,
}: Props) {
  return (
    <>
      {(widgets["net-worth"] || widgets["per-person"]) && (
        <HouseholdSummary
          household={household}
          currencyCode={currencyCode}
          personFilter={personFilter}
          showNetWorth={widgets["net-worth"]}
          showPerPerson={widgets["per-person"]}
        />
      )}
      {widgets["credit-cards"] && accounts.some((acc) => isCreditAccount(acc.type)) && (
        <CreditCardList accounts={accounts} />
      )}
      {needsDashboardDetails(widgets) && !details && (
        <div className="rounded-xl border border-app-border bg-app-surface p-6 text-sm text-muted-foreground">
          {detailsFailed
            ? "Não foi possível carregar alguns blocos. Tente novamente em instantes."
            : "Carregando blocos..."}
        </div>
      )}
      {widgets.investments && details && (
        <InvestmentSnapshot investments={details.investments} currencyCode={details.currencyCode} />
      )}
      {widgets["recent-transactions"] && (
        <RecentTransactions
          personId={personId}
          dashboardMonths={1}
          periodMode="payday"
          cycleKey={activeCycleKey ?? undefined}
          billCycleKey={billCycleKey ?? undefined}
        />
      )}
    </>
  );
}
