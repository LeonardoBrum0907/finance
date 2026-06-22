import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardMonths, DashboardSummary, PersonDTO } from "@finance/shared";
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

export function DashboardPage() {
  const [months, setMonths] = useState<DashboardMonths>(1);
  const [personId, setPersonId] = useState<PersonFilter>("all");

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
        {data && data.accounts.length > 0 && (
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
      ) : !data || data.accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhuma conta conectada ainda
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre uma pessoa e conecte uma conta bancária na aba{" "}
            <strong>Pessoas</strong>.
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

          <div className="grid gap-8 lg:grid-cols-3">
            <GrowthChart
              className="lg:col-span-2"
              data={data.monthlySeries}
              currencyCode={data.currencyCode}
            />
            <CategoryChart
              data={data.categories}
              currencyCode={data.currencyCode}
            />
          </div>

          <div className="grid gap-8 xl:grid-cols-3">
            <div className="flex flex-col gap-8">
              <InsightsPanel insights={data.insights} />
              {hasCreditCards && <CreditCardList accounts={data.accounts} />}
            </div>
            <RecentTransactions
              className="xl:col-span-2"
              transactions={data.recentTransactions}
            />
          </div>
        </>
      )}
    </div>
  );
}
