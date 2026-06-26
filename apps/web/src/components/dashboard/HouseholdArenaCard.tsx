import { useQuery } from "@tanstack/react-query";
import { Medal, Sparkles, Swords, Trophy } from "lucide-react";
import type { HouseholdArenaDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useAssistant } from "../../lib/assistantContext";
import { formatCurrency } from "../../lib/format";

const toneStyles = {
  praise: "border-emerald-200 bg-emerald-50/60",
  roast: "border-amber-200 bg-amber-50/60",
  neutral: "border-slate-200 bg-slate-50/60",
} as const;

const toneText = {
  praise: "text-emerald-800",
  roast: "text-amber-900",
  neutral: "text-slate-800",
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {isCompetitive ? (
              <Trophy className="h-4 w-4 text-amber-500" />
            ) : (
              <Medal className="h-4 w-4 text-brand-600" />
            )}
            {isCompetitive ? "Arena da semana" : "Seu placar"}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{data.periodLabel}</p>
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
          className="shrink-0 text-[11px] font-semibold text-brand-600 hover:underline"
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
                    <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold">
                      {r.rank}
                    </span>
                  )}
                  {r.personName}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-700">{r.verdict}</p>
                {r.badges.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-xs font-bold ${r.net >= 0 ? "text-emerald-700" : "text-rose-600"}`}
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
                  className="mt-1 text-[10px] font-semibold text-brand-600 hover:underline"
                >
                  Abrir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {data.headToHead.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
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
                  className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-50"
                >
                  {h.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1 text-[10px] text-slate-400">
        <Sparkles className="h-3 w-3" />
        Ranking baseado em sobra, disciplina e tendência da semana
      </p>
    </div>
  );
}
