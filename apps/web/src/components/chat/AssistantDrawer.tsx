import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChatThreadDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useAssistant } from "../../lib/assistantContext";
import { ChatConversation } from "./ChatConversation";

export function AssistantDrawer() {
  const {
    isOpen,
    closeAssistant,
    personId,
    setPersonId,
    prefillMessage,
    contextHint,
    pendingThreadId,
    consumePrefill,
  } = useAssistant();
  const queryClient = useQueryClient();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ message: string; contextHint: string } | null>(
    null,
  );
  const openedRef = useRef(false);

  const threads = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => api.get<ChatThreadDTO[]>("/api/chat/threads"),
    enabled: isOpen,
  });

  const createThread = useMutation({
    mutationFn: () => api.post<ChatThreadDTO>("/api/chat/threads"),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      setActiveThreadId(thread.id);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      setPrefill(null);
      return;
    }

    if (openedRef.current) return;
    openedRef.current = true;

    if (pendingThreadId) {
      setActiveThreadId(pendingThreadId);
    } else if (threads.data && threads.data.length > 0) {
      setActiveThreadId(threads.data[0]!.id);
    } else if (threads.data && threads.data.length === 0 && !createThread.isPending) {
      createThread.mutate();
    }

    if (prefillMessage) {
      const consumed = consumePrefill();
      setPrefill({
        message: consumed.message,
        contextHint: consumed.contextHint || contextHint,
      });
    }
  }, [
    isOpen,
    pendingThreadId,
    threads.data,
    prefillMessage,
    contextHint,
    consumePrefill,
    createThread,
  ]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] md:bg-slate-900/30"
        onClick={closeAssistant}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-md"
        role="dialog"
        aria-label="Assistente financeiro"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Assistente</h2>
            <p className="text-[11px] text-slate-500">Ctrl+K para abrir/fechar</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/chat"
              onClick={closeAssistant}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Tela cheia
            </Link>
            <button
              type="button"
              onClick={closeAssistant}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <ChatConversation
            activeThreadId={activeThreadId}
            onThreadChange={setActiveThreadId}
            selectedPersonId={personId}
            onPersonChange={setPersonId}
            compact
            showHeader={false}
            showPersonFilter
            initialPrefill={prefill?.message}
            initialContextHint={prefill?.contextHint}
            onPrefillConsumed={() => setPrefill(null)}
          />
        </div>
      </aside>
    </>
  );
}
