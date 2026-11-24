import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat } from "lucide-react";
import type { TransactionDetailDTO, TransactionRecurringBillDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

interface Props {
  tx: TransactionDetailDTO;
}

/** Listas que mostram contas fixas e precisam recarregar depois do botão. */
const QUERIES_WITH_FIXED_BILLS = [
  "transaction-detail",
  "accounts",
  "dashboard",
  "dashboard-summary",
  "simulations-impact",
  "bill-cycles",
];

function FixedBillInfo({ bill, currencyCode }: { bill: TransactionRecurringBillDTO; currencyCode: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
      <div>
        <p className="text-sm font-semibold text-foreground">Conta fixa: {bill.title}</p>
        <p className="text-xs text-muted-foreground-dark">
          {formatCurrency(bill.expectedAmount, currencyCode)} por mês, todo dia {bill.dayOfMonth}. Aparece nos
          Compromissos.
        </p>
      </div>
    </div>
  );
}

/**
 * "Tornar conta fixa": a cobrança passa a contar todo mês nos Compromissos, com o total
 * do mês das cobranças com a mesma descrição (dois planos no mês somam).
 */
export function RecurringBillSection({ tx }: Props) {
  const queryClient = useQueryClient();
  const makeFixed = useMutation({
    mutationFn: () =>
      api.post<TransactionRecurringBillDTO>(`/api/recurring-bills/from-transaction/${tx.id}`, {}),
    onSuccess: () => {
      for (const key of QUERIES_WITH_FIXED_BILLS) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  if (tx.recurringBill) return <FixedBillInfo bill={tx.recurringBill} currencyCode={tx.currencyCode} />;

  return (
    <div className="space-y-2 rounded-2xl border border-app-border/60 p-4">
      <p className="text-sm font-semibold text-foreground">Essa cobrança se repete todo mês?</p>
      <p className="text-xs text-muted-foreground-dark">
        Vira conta fixa e entra nos Compromissos. O valor previsto é o total do mês com a mesma descrição.
      </p>
      {makeFixed.isError && <p className="text-sm text-danger">Não foi possível criar a conta fixa.</p>}
      <button
        type="button"
        onClick={() => makeFixed.mutate()}
        disabled={makeFixed.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
      >
        <Repeat className="h-4 w-4" />
        {makeFixed.isPending ? "Salvando…" : "Tornar conta fixa"}
      </button>
    </div>
  );
}
