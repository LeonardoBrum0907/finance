import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { ChatAlertDTO, ChatRecapDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useAssistant } from "../../lib/assistantContext";
import { MarkdownMessage } from "../MarkdownMessage";

const severityStyles: Record<ChatAlertDTO["severity"], string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
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

export function WeeklyRecapCard() {
  const { openAssistant } = useAssistant();

  const recap = useQuery({
    queryKey: ["chat-recap-preview"],
    queryFn: async () => {
      try {
        return await api.post<ChatRecapDTO>("/api/chat/recap");
      } catch {
        return null;
      }
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (!recap.data) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Resumo da semana</h3>
      <div className="relative mt-2 max-h-40 overflow-hidden text-xs text-slate-700">
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
            source: "recap",
          })
        }
        className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
      >
        Ver conversa completa
      </button>
    </div>
  );
}
