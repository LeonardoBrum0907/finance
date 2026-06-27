import { useQuery } from "@tanstack/react-query";
import { Medal, Sparkles, Swords, Trophy } from "lucide-react";
import type { HouseholdArenaDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useAssistant } from "../../lib/assistantContext";
import { formatCurrency } from "../../lib/format";

const toneStyles = {
  praise: "border-positive/20 bg-positive/10",
  roast: "border-amber-200 bg-amber-50/60",
  neutral: "border-app-border bg-app-bg/60",
} as const;

const toneText = {
  praise: "text-positive",
  roast: "text-amber-900",
  neutral: "text-foreground",
} as const;

export function HouseholdArenaCard() {
  const { openAssistant } = useAssistant();

  const arena = useQuery({
    queryKey: ["household-arena"],
    queryFn: async () => {
      try {
        return await api.get<HouseholdArenaDTO>("/api/dashboard/arena");
      } catch {
        return null;
      }
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!arena.data || arena.data.rankings.length === 0) return null;

  const data = arena.data;
  const isCompetitive = data.personCount >= 2;

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {isCompetitive ? (
              <Trophy className="h-4 w-4 text-amber-500" />
            ) : (
              <Medal className="h-4 w-4 text-brand" />
            )}
            {isCompetitive ? "Arena da semana" : "Seu placar"}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{data.periodLabel}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            openAssistant({
              threadId: data.householdRecapThreadId,
              contextKey: "recap:weekly:household",
              title: isCompetitive ? "Resumo da casa" : "Resumo da semana",
              source: "arena",
            })
          }
          className="shrink-0 text-[11px] font-semibold text-brand hover:underline"
        >
          Ver resumo
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {data.rankings.map((r) => (
          <li
            key={r.personId}
            className={`rounded-lg border px-3 py-2.5 ${toneStyles[r.tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${toneText[r.tone]}`}>
                  {isCompetitive && (
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-app-surface/80 text-[10px] font-bold">
                      {r.rank}
                    </span>
                  )}
                  {r.personName}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-foreground/90">{r.verdict}</p>
                {r.badges.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-app-surface/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-xs font-bold ${r.net >= 0 ? "text-positive" : "text-negative"}`}
                >
                  {formatCurrency(r.net)}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openAssistant({
                      threadId: r.recapThreadId,
                      personId: r.personId,
                      contextKey: `recap:weekly:person:${r.personId}`,
                      title: `Semana — ${r.personName}`,
                      source: "arena",
                    })
                  }
                  className="mt-1 text-[10px] font-semibold text-brand hover:underline"
                >
                  Abrir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {data.headToHead.length > 0 && (
        <div className="mt-3 border-t border-app-border/60 pt-3">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Swords className="h-3 w-3" />
            Duelos da semana
          </p>
          <ul className="space-y-1.5">
            {data.headToHead.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() =>
                    openAssistant({
                      prefillMessage: `Analise esta comparação: ${h.message}`,
                      contextKey: `alert:${h.id}`,
                      title: "Duelo financeiro",
                      source: "arena",
                    })
                  }
                  className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-foreground/90 hover:bg-app-bg"
                >
                  {h.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Ranking baseado em sobra, disciplina e tendência da semana
      </p>
    </div>
  );
}
