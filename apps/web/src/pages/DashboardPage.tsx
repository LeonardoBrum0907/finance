import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CategoryChartSelection, DashboardMonths, DashboardSummary, PersonDTO } from "@finance/shared";
import { isCreditAccount } from "@finance/shared";
import { api } from "../lib/api";
import { CategoryChart } from "../components/dashboard/CategoryChart";
import { CreditCardList } from "../components/dashboard/CreditCardList";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { GrowthChart } from "../components/dashboard/GrowthChart";
import { InsightsPanel } from "../components/dashboard/InsightsPanel";
import { PeriodSelector } from "../components/dashboard/PeriodSelector";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { RecentTransactions } from "../components/dashboard/RecentTransactions";
import { StatCards } from "../components/dashboard/StatCards";
import { InvestmentSnapshot } from "../components/dashboard/InvestmentSnapshot";

export function DashboardPage() {
  const [months, setMonths] = useState<DashboardMonths>(1);
  const [personId, setPersonId] = useState<PersonFilter>("all");
  const [categorySelection, setCategorySelection] = useState<CategoryChartSelection | null>(null);
  const transactionsRef = useRef<HTMLElement>(null);

  const handleCategorySelect = useCallback((selection: CategoryChartSelection) => {
    setCategorySelection(selection);
    requestAnimationFrame(() => {
      transactionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleClearCategorySelection = useCallback(() => {
    setCategorySelection(null);
  }, []);

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const dashboardUrl =
    personId === "all"
      ? `/api/dashboard?months=${months}`
      : `/api/dashboard?months=${months}&personId=${personId}`;

  const dashboard = useQuery({
    queryKey: ["dashboard", months, personId],
    queryFn: () => api.get<DashboardSummary>(dashboardUrl),
  });

  const data = dashboard.data;
  const hasCreditCards = data?.accounts.some((acc) => isCreditAccount(acc.type)) ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Painel Geral
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Visão consolidada das suas finanças com comparativos por período.
          </p>
        </div>
        {data && (data.accounts.length > 0 || data.investments.positionCount > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            <PersonSelector
              value={personId}
              people={people.data ?? []}
              onChange={setPersonId}
            />
            <PeriodSelector value={months} onChange={setMonths} />
          </div>
        )}
      </div>

      {dashboard.isLoading ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar o painel. Tente novamente em instantes.
        </div>
      ) : !data || (data.accounts.length === 0 && data.investments.positionCount === 0) ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhuma conta conectada ainda
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre em <strong>Pessoas</strong> e conecte em <strong>Contas</strong>.
          </p>
        </div>
      ) : (
        <>
          <StatCards
            netWorth={data.netWorth}
            currencyCode={data.currencyCode}
            period={data.period}
            previousPeriod={data.previousPeriod}
          />

          <InvestmentSnapshot
            investments={data.investments}
            currencyCode={data.currencyCode}
          />

          <div className="grid gap-8 lg:grid-cols-3">
            <GrowthChart
              className="lg:col-span-2"
              data={data.monthlySeries}
              months={months}
              currencyCode={data.currencyCode}
            />
            <CategoryChart
              data={data.categories}
              previousCategories={data.previousCategories}
              currencyCode={data.currencyCode}
              onCategorySelect={handleCategorySelect}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <InsightsPanel insights={data.insights} />
            {hasCreditCards && <CreditCardList accounts={data.accounts} />}
          </div>

          <RecentTransactions
            personId={personId}
            dashboardMonths={months}
            categorySelection={categorySelection}
            onClearCategorySelection={handleClearCategorySelection}
            sectionRef={transactionsRef}
          />
        </>
      )}
    </div>
  );
}
