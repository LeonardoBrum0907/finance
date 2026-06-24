import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Save } from "lucide-react";
import type { PeriodMode, UpdateSettingsInput, UserSettingsDTO } from "@finance/shared";
import { api } from "../lib/api";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
  });

  const [paydayDay, setPaydayDay] = useState<string>("");
  const [defaultPeriodMode, setDefaultPeriodMode] = useState<PeriodMode>("calendar");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setPaydayDay(settings.data.paydayDay?.toString() ?? "");
      setDefaultPeriodMode(settings.data.defaultPeriodMode);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: UpdateSettingsInput) =>
      api.patch<UserSettingsDTO>("/api/settings", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const day = paydayDay.trim() === "" ? null : Number(paydayDay);
    if (day !== null && (day < 1 || day > 31 || Number.isNaN(day))) return;

    save.mutate({
      paydayDay: day,
      defaultPeriodMode,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Personalize como o app calcula seus períodos financeiros.
        </p>
      </div>

      {settings.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Carregando...
        </div>
      ) : settings.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar as configurações.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
        >
          <div>
            <label
              htmlFor="paydayDay"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700"
            >
              <Calendar className="h-4 w-4 text-brand-600" />
              Dia que recebo
            </label>
            <input
              id="paydayDay"
              type="number"
              min={1}
              max={31}
              placeholder="Ex.: 25"
              value={paydayDay}
              onChange={(e) => setPaydayDay(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="mt-2 text-xs text-slate-500">
              Seu ciclo financeiro vai do dia seguinte ao pagamento até o dia {paydayDay || "X"}{" "}
              de cada mês (ex.: 26 → 25).
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Modo padrão do painel</p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setDefaultPeriodMode("calendar")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  defaultPeriodMode === "calendar"
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Mês calendário
              </button>
              <button
                type="button"
                onClick={() => setDefaultPeriodMode("payday")}
                disabled={!paydayDay}
                className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  defaultPeriodMode === "payday"
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Meu ciclo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
            {saved && <span className="text-sm text-emerald-600">Salvo com sucesso!</span>}
            {save.isError && (
              <span className="text-sm text-red-600">
                {(save.error as Error)?.message ?? "Erro ao salvar"}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
