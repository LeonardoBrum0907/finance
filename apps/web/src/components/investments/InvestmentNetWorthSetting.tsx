import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PieChart } from "lucide-react";
import type { UpdateSettingsInput, UserSettingsDTO } from "@finance/shared";
import { api } from "../../lib/api";

export function InvestmentNetWorthSetting() {
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
  });

  const save = useMutation({
    mutationFn: (body: UpdateSettingsInput) =>
      api.patch<UserSettingsDTO>("/api/settings", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const included = settings.data?.includeInvestmentsInNetWorth ?? true;
  const disabled = settings.isLoading || save.isPending;

  const handleToggle = () => {
    if (disabled) return;
    save.mutate({ includeInvestmentsInNetWorth: !included });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-500/10 bg-brand-500/10">
          <PieChart className="h-4 w-4 text-brand-600" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">
            Incluir no patrimônio líquido do painel
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Quando desativado, o saldo de investimentos não entra no total do Painel Geral.
            Útil se os dados estiverem desatualizados.
          </p>
          {save.isError && (
            <p className="mt-1 text-xs text-red-600">
              {(save.error as Error)?.message ?? "Não foi possível salvar"}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={included}
        disabled={disabled}
        onClick={handleToggle}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
          included ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
            included ? "translate-x-6" : "translate-x-1"
          }`}
        />
        <span className="sr-only">
          {included ? "Investimentos incluídos no patrimônio" : "Investimentos excluídos do patrimônio"}
        </span>
      </button>
    </div>
  );
}
