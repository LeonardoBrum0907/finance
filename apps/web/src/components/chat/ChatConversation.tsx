import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import type { ChatContextSummaryDTO, ChatSuggestionDTO, PersonDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { MarkdownMessage } from "../MarkdownMessage";
import { ProposalCard } from "./ProposalCard";
import { ChatStatusBar } from "./ChatStatusBar";
import { FollowUpChips } from "./FollowUpChips";
import { RichMessageRenderer } from "./RichMessageRenderer";
import { ChatEmptyState } from "./ChatEmptyState";
import { useChatStream } from "../../hooks/useChatStream";
import { useConfirm } from "../../lib/confirm";
import { formatDate } from "../../lib/format";

interface Props {
  activeThreadId: string | null;
  onThreadChange?: (id: string | null) => void;
  selectedPersonId: string;
  onPersonChange: (id: string) => void;
  compact?: boolean;
  showHeader?: boolean;
  showPersonFilter?: boolean;
  initialPrefill?: string;
  initialContextHint?: string;
  onPrefillConsumed?: () => void;
}

function MessageFooter({
  syncAt,
  dataPeriod,
}: {
  syncAt?: string | null;
  dataPeriod?: string;
}) {
  if (!syncAt && !dataPeriod) return null;
  return (
    <p className="mt-2 border-t border-slate-200/60 pt-2 text-[10px] text-slate-400">
      {dataPeriod && <>Período: {dataPeriod}</>}
      {syncAt && (
        <>
          {dataPeriod ? " · " : ""}
          Dados sincronizados em {formatDate(syncAt)}
        </>
      )}
    </p>
  );
}

export function ChatConversation({
  activeThreadId,
  onThreadChange: _onThreadChange,
  selectedPersonId,
  onPersonChange,
  compact = false,
  showHeader = true,
  showPersonFilter = true,
  initialPrefill,
  initialContextHint,
  onPrefillConsumed,
}: Props) {
  const confirm = useConfirm();
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prefillHandled = useRef(false);

  const status = useQuery({
    queryKey: ["chat-status"],
    queryFn: () => api.get<{ configured: boolean }>("/api/chat/status"),
  });

  const aiConfigured = status.data?.configured !== false;

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const suggestionsQuery = useQuery({
    queryKey: ["chat-suggestions", selectedPersonId],
    queryFn: () => {
      const params = selectedPersonId ? `?personId=${encodeURIComponent(selectedPersonId)}` : "";
      return api.get<ChatSuggestionDTO[]>(`/api/chat/suggestions${params}`);
    },
    enabled: aiConfigured,
  });

  const contextSummary = useQuery({
    queryKey: ["chat-context-summary", selectedPersonId],
    queryFn: () => {
      const params = selectedPersonId ? `?personId=${encodeURIComponent(selectedPersonId)}` : "";
      return api.get<ChatContextSummaryDTO>(`/api/chat/context-summary${params}`);
    },
    enabled: aiConfigured,
  });

  const selectedPerson = people.data?.find((p) => p.id === selectedPersonId);

  const {
    messages,
    messagesLoaded,
    streaming,
    streamingPhase,
    toolActivity,
    sendMessage,
    regenerate,
    clearConversation,
    stop,
    refetchMessages,
  } = useChatStream({
    threadId: activeThreadId,
    personId: selectedPersonId,
    enabled: aiConfigured && Boolean(activeThreadId),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingPhase, toolActivity]);

  useEffect(() => {
    if (
      !initialPrefill ||
      prefillHandled.current ||
      !activeThreadId ||
      streaming ||
      !messagesLoaded
    ) {
      return;
    }
    prefillHandled.current = true;
    if (messages.length > 0) {
      onPrefillConsumed?.();
      return;
    }
    void sendMessage(initialPrefill, initialContextHint).then(() => onPrefillConsumed?.());
  }, [
    initialPrefill,
    initialContextHint,
    activeThreadId,
    streaming,
    messagesLoaded,
    messages.length,
    sendMessage,
    onPrefillConsumed,
  ]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming || !aiConfigured) return;
    setInput("");
    await sendMessage(text);
  }

  const showSuggestions = messages.length === 0 && !streaming;
  const inputDisabled = streaming || !aiConfigured || !activeThreadId;
  const lastMessage = messages[messages.length - 1];
  const canRegenerate =
    !streaming && lastMessage?.role === "assistant" && lastMessage.content.length > 0;

  const followUps =
    !streaming && lastMessage?.role === "assistant"
      ? (lastMessage.metadata?.followUps ?? [])
      : [];

  async function copyMessage(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${compact ? "" : ""}`}>
      {showHeader && (
        <div className="mb-3 shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              {!compact && (
                <>
                  <h1 className="text-2xl font-semibold text-slate-800">Assistente</h1>
                  <p className="text-sm text-slate-500">
                    Converse sobre suas finanças
                    {selectedPerson ? ` de ${selectedPerson.name}` : ""}.
                  </p>
                </>
              )}
              <ChatStatusBar
                people={people.data ?? []}
                streamingPhase={streamingPhase}
                toolActivity={toolActivity}
              />
            </div>
            {activeThreadId && !compact && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Limpar conversa",
                    message: "Limpar todas as mensagens desta conversa?",
                    confirmLabel: "Limpar",
                    variant: "danger",
                  });
                  if (ok) clearConversation();
                }}
                disabled={streaming || messages.length === 0}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Limpar conversa
              </button>
            )}
          </div>
          {showPersonFilter && (
            <div className="mt-3">
              <label htmlFor="chat-person" className="sr-only">
                Filtrar por pessoa
              </label>
              <select
                id="chat-person"
                value={selectedPersonId}
                onChange={(e) => onPersonChange(e.target.value)}
                disabled={streaming}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Todas as pessoas</option>
                {people.data?.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.relationship ? ` (${person.relationship})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {status.data && !status.data.configured && (
        <div className="mb-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          A IA não está configurada no servidor.
        </div>
      )}

      <div
        className={`min-h-0 flex-1 space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 ${compact ? "text-sm" : ""}`}
      >
        {showSuggestions && (
          <ChatEmptyState
            summary={contextSummary.data}
            suggestions={suggestionsQuery.data ?? []}
            onSelectIntent={(msg) => sendMessage(msg)}
            disabled={inputDisabled}
          />
        )}

        {messages.map((m, idx) => {
          const isLastAssistant =
            m.role === "assistant" && idx === messages.length - 1 && !streaming;
          return (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.role === "assistant" ? (
                  <>
                    {m.content ? (
                      <MarkdownMessage content={m.content} />
                    ) : streaming ? (
                      <span className="animate-pulse text-slate-400">
                        {toolActivity ?? "Pensando…"}
                      </span>
                    ) : null}
                    {m.metadata?.blocks && m.metadata.blocks.length > 0 && (
                      <RichMessageRenderer
                        blocks={m.metadata.blocks}
                        onActionPrompt={(msg) => sendMessage(msg)}
                      />
                    )}
                    {m.proposal && (
                      <ProposalCard
                        proposal={m.proposal}
                        threadId={activeThreadId}
                        onResolved={refetchMessages}
                      />
                    )}
                    {m.content && (
                      <MessageFooter
                        syncAt={m.metadata?.syncAt}
                        dataPeriod={m.metadata?.dataPeriod}
                      />
                    )}
                    {isLastAssistant && m.content && (
                      <button
                        type="button"
                        onClick={() => copyMessage(m.id, m.content)}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="h-3 w-3" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copiar
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          );
        })}

        {canRegenerate && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => regenerate()}
              className="text-xs text-slate-500 underline hover:text-brand-600"
            >
              Regenerar resposta
            </button>
          </div>
        )}

        {followUps.length > 0 && (
          <FollowUpChips
            suggestions={followUps}
            onSelect={(msg) => sendMessage(msg)}
            disabled={inputDisabled}
          />
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex shrink-0 gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={inputDisabled}
          className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Parar
          </button>
        ) : (
          <button
            type="submit"
            disabled={inputDisabled || !input.trim()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Enviar
          </button>
        )}
      </form>
    </div>
  );
}
