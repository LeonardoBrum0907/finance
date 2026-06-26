import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Save, Users } from "lucide-react";
import type {
  PaydayCycleAnchor,
  PeriodMode,
  PersonDTO,
  UpdateSettingsInput,
  UserSettingsDTO,
} from "@finance/shared";
import { describePaydayCycleBounds, isPaydayDayConfigured } from "@finance/shared";
import { api } from "../lib/api";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<UserSettingsDTO>("/api/settings"),
  });

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const [paydayByPerson, setPaydayByPerson] = useState<Record<string, string>>({});
  const [anchorByPerson, setAnchorByPerson] = useState<Record<string, PaydayCycleAnchor>>({});
  const [defaultPeriodMode, setDefaultPeriodMode] = useState<PeriodMode>("calendar");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setDefaultPeriodMode(settings.data.defaultPeriodMode);
    }
  }, [settings.data]);

  useEffect(() => {
    if (people.data) {
      const days: Record<string, string> = {};
      const anchors: Record<string, PaydayCycleAnchor> = {};
      for (const person of people.data) {
        days[person.id] = person.paydayDay?.toString() ?? "";
        anchors[person.id] = person.paydayCycleAnchor;
      }
      setPaydayByPerson(days);
      setAnchorByPerson(anchors);
    }
  }, [people.data]);

  const saveSettings = useMutation({
    mutationFn: (body: UpdateSettingsInput) =>
      api.patch<UserSettingsDTO>("/api/settings", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
    },
  });

  const savePerson = useMutation({
    mutationFn: ({
      id,
      name,
      relationship,
      paydayDay,
      paydayCycleAnchor,
    }: {
      id: string;
      name: string;
      relationship: string | null;
      paydayDay: number | null;
      paydayCycleAnchor: PaydayCycleAnchor;
    }) =>
      api.put<PersonDTO>(`/api/people/${id}`, {
        name,
        relationship: relationship ?? undefined,
        paydayDay,
        paydayCycleAnchor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const anyPaydayConfigured =
    people.data?.some((p) => isPaydayDayConfigured(p.paydayDay)) ||
    settings.data?.paydayConfigured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const personUpdates = (people.data ?? [])
      .map((person) => {
        const raw = paydayByPerson[person.id]?.trim() ?? "";
        const day = raw === "" ? null : Number(raw);
        if (day !== null && (day < 1 || day > 31 || Number.isNaN(day))) return null;

        const anchor = anchorByPerson[person.id] ?? person.paydayCycleAnchor;
        if (day === person.paydayDay && anchor === person.paydayCycleAnchor) return null;

        return { person, day, anchor };
      })
      .filter((u): u is { person: PersonDTO; day: number | null; anchor: PaydayCycleAnchor } =>
        u !== null,
      );

    await Promise.all(
      personUpdates.map(({ person, day, anchor }) =>
        savePerson.mutateAsync({
          id: person.id,
          name: person.name,
          relationship: person.relationship,
          paydayDay: day,
          paydayCycleAnchor: anchor,
        }),
      ),
    );

    await saveSettings.mutateAsync({ defaultPeriodMode });

    const refreshed = await people.refetch();
    if (refreshed.data) {
      queryClient.setQueryData(["settings"], {
        ...settings.data!,
        paydayConfigured:
          refreshed.data.some((p) => isPaydayDayConfigured(p.paydayDay)) ||
          isPaydayDayConfigured(settings.data?.paydayDay),
      });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isSaving = saveSettings.isPending || savePerson.isPending;
  const isLoading = settings.isLoading || people.isLoading;
  const isError = settings.isError || people.isError;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Personalize como o app calcula os períodos financeiros de cada pessoa.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Carregando...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar as configurações.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
        >
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Users className="h-4 w-4 text-brand-600" />
              Ciclo financeiro por pessoa
            </p>

            {people.data?.length === 0 ? (
              <p className="text-sm text-slate-500">
                Cadastre pessoas em{" "}
                <Link to="/pessoas" className="font-medium text-brand-600 hover:underline">
                  Pessoas
                </Link>{" "}
                para configurar o dia de recebimento de cada uma.
              </p>
            ) : (
              <div className="space-y-4">
                {people.data?.map((person) => {
                  const dayValue = paydayByPerson[person.id] ?? "";
                  const anchor = anchorByPerson[person.id] ?? person.paydayCycleAnchor;
                  return (
                    <div
                      key={person.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                    >
                      <label
                        htmlFor={`payday-${person.id}`}
                        className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800"
                      >
                        <Calendar className="h-4 w-4 text-brand-600" />
                        {person.name}
                        {person.relationship && (
                          <span className="font-normal text-slate-500">
                            ({person.relationship})
                          </span>
                        )}
                      </label>
                      <input
                        id={`payday-${person.id}`}
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Ex.: 25"
                        value={dayValue}
                        onChange={(e) =>
                          setPaydayByPerson((prev) => ({
                            ...prev,
                            [person.id]: e.target.value,
                          }))
                        }
                        className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                      <p className="mt-3 text-xs font-medium text-slate-600">
                        O pagamento é o…
                      </p>
                      <div className="mt-1.5 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setAnchorByPerson((prev) => ({ ...prev, [person.id]: "end" }))
                          }
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            anchor === "end"
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          Último dia do ciclo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAnchorByPerson((prev) => ({ ...prev, [person.id]: "start" }))
                          }
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            anchor === "start"
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          Primeiro dia do ciclo
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {describePaydayCycleBounds(dayValue || "X", anchor)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
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
                disabled={!anyPaydayConfigured}
                className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  defaultPeriodMode === "payday"
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Meu ciclo
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Na visão consolidada, o modo ciclo só funciona quando todas as pessoas têm o mesmo
              dia de pagamento e a mesma posição no ciclo.
            </p>
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            {saved && <span className="text-sm text-emerald-600">Salvo com sucesso!</span>}
            {(saveSettings.isError || savePerson.isError) && (
              <span className="text-sm text-red-600">
                {((saveSettings.error ?? savePerson.error) as Error)?.message ?? "Erro ao salvar"}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
