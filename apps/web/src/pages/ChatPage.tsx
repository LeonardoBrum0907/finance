import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatThreadDTO, PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { ProposalCard } from "../components/chat/ProposalCard";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { ChatSuggestionChips } from "../components/chat/ChatSuggestionChips";
import { ChatStatusBar } from "../components/chat/ChatStatusBar";
import { useChatStream } from "../hooks/useChatStream";
import { getChatSuggestions } from "../lib/chatSuggestions";

export function ChatPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const status = useQuery({
    queryKey: ["chat-status"],
    queryFn: () => api.get<{ configured: boolean }>("/api/chat/status"),
  });

  const aiConfigured = status.data?.configured !== false;

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const threads = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => api.get<ChatThreadDTO[]>("/api/chat/threads"),
  });

  const createThread = useMutation({
    mutationFn: () => api.post<ChatThreadDTO>("/api/chat/threads"),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      setActiveThreadId(thread.id);
    },
  });

  useEffect(() => {
    if (threads.isLoading || activeThreadId) return;
    if (threads.data && threads.data.length > 0) {
      setActiveThreadId(threads.data[0].id);
    } else if (
      threads.data &&
      threads.data.length === 0 &&
      !createThread.isPending &&
      !createThread.isSuccess
    ) {
      createThread.mutate();
    }
  }, [threads.data, threads.isLoading, activeThreadId, createThread.isPending]);

  const selectedPerson = people.data?.find((p) => p.id === selectedPersonId);

  const {
    messages,
    streaming,
    streamingPhase,
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
  }, [messages, streamingPhase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming || !aiConfigured) return;
    setInput("");
    await sendMessage(text);
  }

  const suggestions = getChatSuggestions({
    people: people.data ?? [],
    selectedPersonId,
    selectedPersonName: selectedPerson?.name,
  });

  const showSuggestions = messages.length === 0 && !streaming;
  const inputDisabled = streaming || !aiConfigured || !activeThreadId;
  const lastMessage = messages[messages.length - 1];
  const canRegenerate =
    !streaming && lastMessage?.role === "assistant" && lastMessage.content.length > 0;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden md:flex-row md:gap-4 lg:h-[calc(100vh-4rem)]">
      <ChatSidebar
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        disabled={streaming}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="mb-4 shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Assistente</h1>
              <p className="text-sm text-slate-500">
                Converse sobre suas finanças. A IA usa os dados das contas conectadas
                {selectedPerson ? ` de ${selectedPerson.name}` : ""}.
              </p>
              <ChatStatusBar
                people={people.data ?? []}
                streamingPhase={streamingPhase}
              />
            </div>
            {activeThreadId && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Limpar todas as mensagens desta conversa?")) {
                    clearConversation();
                  }
                }}
                disabled={streaming || messages.length === 0}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Limpar conversa
              </button>
            )}
          </div>
          <div className="mt-3">
            <label htmlFor="chat-person" className="sr-only">
              Filtrar por pessoa
            </label>
            <select
              id="chat-person"
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
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
        </div>

        {status.data && !status.data.configured && (
          <div className="mb-4 shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            A IA não está configurada no servidor. Defina o provider e a respectiva
            chave de API no arquivo <code>.env</code>.
          </div>
        )}

        {showSuggestions && (
          <div className="mb-3 shrink-0">
            <ChatSuggestionChips
              suggestions={suggestions}
              onSelect={(text) => sendMessage(text)}
              disabled={inputDisabled}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          {messages.length === 0 && !streaming && (
            <p className="text-sm text-slate-400">
              Faça uma pergunta ou escolha uma sugestão acima.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
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
                      <span className="animate-pulse text-slate-400">Pensando…</span>
                    ) : null}
                    {m.proposal?.status === "pending" && (
                      <ProposalCard
                        proposal={m.proposal}
                        threadId={activeThreadId}
                        onResolved={refetchMessages}
                      />
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
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
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex shrink-0 gap-2">
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
              className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Parar
            </button>
          ) : (
            <button
              type="submit"
              disabled={inputDisabled || !input.trim()}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Enviar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
