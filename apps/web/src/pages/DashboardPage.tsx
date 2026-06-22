import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary, PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { ConnectAccount } from "../components/ConnectAccount";

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard"),
  });

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const data = dashboard.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Painel</h1>
        <p className="text-sm text-slate-500">
          Visão consolidada das contas conectadas.
        </p>
      </div>

      <ConnectAccount people={people.data ?? []} />

      {dashboard.isLoading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : !data || data.accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nenhuma conta conectada ainda. Use o botão acima para conectar.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Saldo consolidado</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">
                {formatCurrency(data.totalBalance, data.currencyCode)}
              </p>
            </div>
            {data.perPerson.map((p) => (
              <div
                key={p.personId}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <p className="text-sm text-slate-500">{p.personName}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-800">
                  {formatCurrency(p.balance, data.currencyCode)}
                </p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="mb-3 text-lg font-medium text-slate-800">Contas</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="font-medium text-slate-800">{acc.name}</p>
                    <p className="text-xs text-slate-500">
                      {acc.personName} · {acc.type ?? "Conta"}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(acc.balance, acc.currencyCode)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-slate-800">
              Extrato recente
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">Descrição</th>
                    <th className="px-4 py-2">Pessoa</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-2 text-slate-800">{tx.description}</td>
                      <td className="px-4 py-2 text-slate-500">{tx.personName}</td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          tx.amount < 0 ? "text-red-600" : "text-brand-600"
                        }`}
                      >
                        {formatCurrency(tx.amount, tx.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
