import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Palette, Save, Users } from "lucide-react";
import type {
  AppTheme,
  PaydayCycleAnchor,
  PeriodMode,
  PersonDTO,
  UpdateSettingsInput,
  UserSettingsDTO,
} from "@finance/shared";
import { describePaydayCycleBounds, isPaydayDayConfigured } from "@finance/shared";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme/useTheme";
import { DashboardWidgetsSettings } from "../components/settings/DashboardWidgetsSettings";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, setTheme, isLoading: themeLoading } = useTheme();
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeSaving, setThemeSaving] = useState(false);
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

  const handleThemeChange = async (next: AppTheme) => {
    if (next === theme) return;
    setThemeError(null);
    setThemeSaving(true);
    try {
      await setTheme(next);
    } catch (error) {
      setThemeError((error as Error).message ?? "Erro ao salvar o tema.");
    } finally {
      setThemeSaving(false);
    }
  };

  const isSaving = saveSettings.isPending || savePerson.isPending;
  const isLoading = settings.isLoading || people.isLoading;
  const isError = settings.isError || people.isError;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize como o app calcula os períodos financeiros de cada pessoa.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-app-border bg-app-surface p-8 text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-danger-border bg-danger-muted p-6 text-sm text-danger">
          Não foi possível carregar as configurações.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-app-border bg-app-surface p-6 shadow-xs"
        >
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground/90">
              <Users className="h-4 w-4 text-brand" />
              Ciclo financeiro por pessoa
            </p>

            {people.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cadastre pessoas em{" "}
                <Link to="/pessoas" className="font-medium text-brand hover:underline">
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
                      className="rounded-lg border border-app-border/60 bg-app-bg/50 p-4"
                    >
                      <label
                        htmlFor={`payday-${person.id}`}
                        className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
                      >
                        <Calendar className="h-4 w-4 text-brand" />
                        {person.name}
                        {person.relationship && (
                          <span className="font-normal text-muted-foreground">
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
                        className="w-full max-w-xs rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                      <p className="mt-3 text-xs font-medium text-muted-foreground">
                        O pagamento é o…
                      </p>
                      <div className="mt-1.5 inline-flex rounded-lg border border-app-border bg-app-surface p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setAnchorByPerson((prev) => ({ ...prev, [person.id]: "end" }))
                          }
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            anchor === "end"
                              ? "bg-brand/10 text-brand"
                              : "text-muted-foreground hover:text-foreground"
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
                              ? "bg-brand/10 text-brand"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Primeiro dia do ciclo
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {describePaydayCycleBounds(dayValue || "X", anchor)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DashboardWidgetsSettings />

          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground/90">
              <Palette className="h-4 w-4 text-brand" />
              Aparência
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    id: "default" as const,
                    label: "Padrão",
                    description: "Visual atual, verdes vibrantes e contraste nítido.",
                    swatches: ["bg-app-bg", "bg-positive", "bg-negative"],
                  },
                  {
                    id: "comfy" as const,
                    label: "Comfy",
                    description: "Tons pastéis, off-white e negativos em cinza suave.",
                    swatches: ["bg-[#faf9f6]", "bg-[#a7d7c5]", "bg-[#94a3b8]"],
                  },
                ] as const
              ).map((option) => {
                const selected = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={themeLoading || themeSaving}
                    onClick={() => void handleThemeChange(option.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-brand bg-brand/5 shadow-sm"
                        : "border-app-border bg-app-bg hover:border-app-border/80"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="mb-3 flex gap-2">
                      {option.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className={`h-6 w-6 rounded-full border border-app-border/60 ${swatch}`}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{option.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  </button>
                );
              })}
            </div>
            {themeError && <p className="mt-2 text-xs text-danger">{themeError}</p>}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground/90">Modo padrão do painel</p>
            <div className="inline-flex rounded-lg border border-app-border bg-app-bg p-1">
              <button
                type="button"
                onClick={() => setDefaultPeriodMode("calendar")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  defaultPeriodMode === "calendar"
                    ? "bg-app-surface text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
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
                    ? "bg-app-surface text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Meu ciclo
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Na visão consolidada, o modo ciclo só funciona quando todas as pessoas têm o mesmo
              dia de pagamento e a mesma posição no ciclo.
            </p>
          </div>

          <div className="flex items-center gap-3 border-t border-app-border/60 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            {saved && <span className="text-sm text-positive">Salvo com sucesso!</span>}
            {(saveSettings.isError || savePerson.isError) && (
              <span className="text-sm text-danger">
                {((saveSettings.error ?? savePerson.error) as Error)?.message ?? "Erro ao salvar"}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
