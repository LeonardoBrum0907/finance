import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useAssistant } from "../../lib/assistantContext";
import { createFreeChatThread, resolveChatThread } from "../../hooks/useResolveChatThread";
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
    pendingContextKey,
    pendingTitle,
    consumePrefill,
  } = useAssistant();
  const queryClient = useQueryClient();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ message: string; contextHint: string } | null>(
    null,
  );
  const [resolving, setResolving] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      setPrefill(null);
      setActiveThreadId(null);
      return;
    }

    if (openedRef.current) return;
    openedRef.current = true;

    setResolving(true);
    void (async () => {
      try {
        let threadId: string;
        if (pendingThreadId) {
          threadId = pendingThreadId;
        } else if (pendingContextKey) {
          const thread = await resolveChatThread(
            pendingContextKey,
            pendingTitle ?? undefined,
          );
          threadId = thread.id;
        } else {
          const thread = await createFreeChatThread();
          threadId = thread.id;
        }
        setActiveThreadId(threadId);
        queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      } finally {
        setResolving(false);
      }
    })();

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
    pendingContextKey,
    pendingTitle,
    prefillMessage,
    contextHint,
    consumePrefill,
    queryClient,
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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-app-border bg-app-bg shadow-2xl md:max-w-md"
        role="dialog"
        aria-label="Assistente financeiro"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-app-border bg-app-surface px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Assistente</h2>
            <p className="text-[11px] text-muted-foreground-dark">Ctrl+K para abrir/fechar</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/chat"
              onClick={closeAssistant}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground-dark hover:bg-slate-100 hover:text-foreground/90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Tela cheia
            </Link>
            <button
              type="button"
              onClick={closeAssistant}
              className="rounded-md p-1.5 text-muted-foreground-dark hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          {resolving || !activeThreadId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground-dark">
              Carregando conversa...
            </div>
          ) : (
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
          )}
        </div>
      </aside>
    </>
  );
}
