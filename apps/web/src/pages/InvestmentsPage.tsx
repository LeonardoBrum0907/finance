import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InvestmentsSummaryDTO, PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { PersonSelector, type PersonFilter } from "../components/dashboard/PersonSelector";
import { AllocationChart } from "../components/investments/AllocationChart";
import { InvestmentStatCards } from "../components/investments/InvestmentStatCards";
import { InvestmentTransactionsList } from "../components/investments/InvestmentTransactionsList";
import { InvestmentsSkeleton } from "../components/investments/InvestmentsSkeleton";
import { InvestmentDataNotice } from "../components/investments/InvestmentDataNotice";
import { InvestmentNetWorthSetting } from "../components/investments/InvestmentNetWorthSetting";
import { PositionsTable } from "../components/investments/PositionsTable";
import { cardClass } from "../components/dashboard/motion";

const FIXED_INCOME_TYPES = new Set(["FIXED_INCOME", "TREASURY", "CDB", "LCI", "LCA"]);

export function InvestmentsPage() {
  const [personId, setPersonId] = useState<PersonFilter>("all");

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const investmentsUrl =
    personId === "all"
      ? "/api/investments"
      : `/api/investments?personId=${personId}`;

  const investments = useQuery({
    queryKey: ["investments", personId],
    queryFn: () => api.get<InvestmentsSummaryDTO>(investmentsUrl),
  });

  const data = investments.data;

  const stalePositions = useMemo(
    () =>
      (data?.positions ?? [])
        .filter((p) => p.isStale)
        .map((p) => ({
          name: p.name,
          referenceDate: p.referenceDate,
          staleDays: p.staleDays,
        })),
    [data?.positions],
  );

  const insights = useMemo(() => {
    if (!data || data.positions.length === 0) return [];

    const lines: string[] = [];
    const top = data.positions[0];
    if (top) {
      lines.push(
        `Maior posição: ${top.name} (${((top.balance / data.summary.totalBalance) * 100).toFixed(0)}% da carteira)`,
      );
    }

    let fixedIncome = 0;
    let variable = 0;
    for (const pos of data.positions) {
      const isFixed =
        (pos.type && FIXED_INCOME_TYPES.has(pos.type)) ||
        (pos.subtype && FIXED_INCOME_TYPES.has(pos.subtype));
      if (isFixed) fixedIncome += pos.balance;
      else variable += pos.balance;
    }
    const total = fixedIncome + variable;
    if (total > 0) {
      lines.push(
        `Renda fixa ${((fixedIncome / total) * 100).toFixed(0)}% · Variável ${((variable / total) * 100).toFixed(0)}%`,
      );
    }

    return lines;
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Investimentos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Carteira, alocação e movimentações sincronizadas via Open Finance.
          </p>
        </div>
        {data && data.summary.positionCount > 0 && (
          <PersonSelector
            value={personId}
            people={people.data ?? []}
            onChange={setPersonId}
          />
        )}
      </div>

      {investments.isLoading ? (
        <InvestmentsSkeleton />
      ) : investments.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar os investimentos. Tente novamente em instantes.
        </div>
      ) : !data || data.summary.positionCount === 0 ? (
        <div className="space-y-4">
          <InvestmentNetWorthSetting />
          <InvestmentDataNotice
            lastSyncedAt={data?.lastSyncedAt ?? null}
            investmentSource={data?.investmentSource}
            stalePositionCount={data?.summary?.stalePositionCount ?? 0}
            stalePositions={stalePositions}
          />
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {data && data.recentTransactions.length > 0
                ? "Nenhuma posição ativa na carteira"
                : "Nenhum investimento sincronizado"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {data && data.recentTransactions.length > 0
                ? "Há movimentações no histórico, mas posições resgatadas ou com saldo zerado não aparecem aqui."
                : "Conecte sua corretora (ex.: Íon) e sincronize em Contas."}
            </p>
          </div>
          {data && data.recentTransactions.length > 0 && (
            <InvestmentTransactionsList
              transactions={data.recentTransactions}
              currencyCode={data.currencyCode}
            />
          )}
        </div>
      ) : (
        <>
          <InvestmentNetWorthSetting />
          <InvestmentDataNotice
            lastSyncedAt={data.lastSyncedAt}
            investmentSource={data.investmentSource}
            stalePositionCount={data.summary.stalePositionCount}
            stalePositions={stalePositions}
          />
          <InvestmentStatCards
            totalBalance={data.summary.totalBalance}
            unrealizedProfit={data.summary.unrealizedProfit}
            positionCount={data.summary.positionCount}
            currencyCode={data.currencyCode}
          />

          <div className="grid gap-8 lg:grid-cols-2">
            <AllocationChart
              allocation={data.allocation}
              currencyCode={data.currencyCode}
            />
            <div className={cardClass}>
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Insights</h2>
              {insights.length > 0 ? (
                <ul className="space-y-3">
                  {insights.map((line) => (
                    <li
                      key={line}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Sem insights disponíveis.</p>
              )}
            </div>
          </div>

          <PositionsTable positions={data.positions} currencyCode={data.currencyCode} />

          <InvestmentTransactionsList
            transactions={data.recentTransactions}
            currencyCode={data.currencyCode}
          />
        </>
      )}
    </div>
  );
}
