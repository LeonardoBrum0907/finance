import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { ChatAlertDTO, ChatRecapDTO, HouseholdArenaDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useAssistant } from "../../lib/assistantContext";
import { MarkdownMessage } from "../MarkdownMessage";

const severityStyles: Record<ChatAlertDTO["severity"], string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-positive/20 bg-positive/10 text-positive",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function AssistantAlertBanner() {
  const { openAssistant } = useAssistant();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = useQuery({
    queryKey: ["chat-alerts"],
    queryFn: () => api.get<ChatAlertDTO[]>("/api/chat/alerts"),
  });

  const visible = (alerts.data ?? []).filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const top = visible[0]!;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${severityStyles[top.severity]}`}
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{top.message}</p>
        <button
          type="button"
          onClick={() =>
            openAssistant({
              prefillMessage: top.suggestionMessage,
              source: "alert",
              contextKey: top.contextKey ?? `alert:${top.id}`,
              title: "Alerta",
              personId: top.personId,
            })
          }
          className="mt-1 text-xs font-semibold underline hover:no-underline"
        >
          Abrir no assistente
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDismissed((prev) => new Set(prev).add(top.id))}
        className="shrink-0 rounded p-1 opacity-60 hover:opacity-100"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

type RecapTab = "household" | string;

export function WeeklyRecapCard() {
  const { openAssistant } = useAssistant();
  const [activeTab, setActiveTab] = useState<RecapTab>("household");

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

  const recap = useQuery({
    queryKey: ["chat-recap-preview", activeTab],
    queryFn: async () => {
      try {
        const body =
          activeTab === "household"
            ? { scope: "household" as const }
            : { scope: "person" as const, personId: activeTab };
        return await api.post<ChatRecapDTO>("/api/chat/recap", body);
      } catch {
        return null;
      }
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
    enabled: arena.isFetched,
  });

  if (!recap.data) return null;

  const tabs: { id: RecapTab; label: string }[] = [{ id: "household", label: "Casa" }];
  if (arena.data && arena.data.personCount >= 2) {
    for (const r of arena.data.rankings) {
      tabs.push({ id: r.personId, label: r.personName });
    }
  } else if (arena.data?.rankings[0]) {
    tabs[0] = { id: "household", label: arena.data.rankings[0].personName };
  }

  const activePerson = arena.data?.rankings.find((r) => r.personId === activeTab);
  const contextKey =
    activeTab === "household"
      ? "recap:weekly:household"
      : `recap:weekly:person:${activeTab}`;
  const title =
    activeTab === "household"
      ? arena.data && arena.data.personCount > 1
        ? "Resumo da casa"
        : "Resumo da semana"
      : `Semana — ${activePerson?.personName ?? ""}`;

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Resumo da semana</h3>
        {tabs.length > 1 && (
          <div className="flex flex-wrap gap-1 rounded-lg border border-app-border bg-app-bg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-app-surface text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-2 max-h-40 overflow-hidden text-xs text-foreground/90">
        <MarkdownMessage content={recap.data.content} />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
      </div>
      <button
        type="button"
        onClick={() =>
          openAssistant({
            threadId: recap.data!.threadId,
            contextKey,
            title,
            personId: activeTab !== "household" ? activeTab : undefined,
            source: "recap",
          })
        }
        className="mt-2 text-xs font-semibold text-brand hover:underline"
      >
        Ver conversa completa
      </button>
    </div>
  );
}
