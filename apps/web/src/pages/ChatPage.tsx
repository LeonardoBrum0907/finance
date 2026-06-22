import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatMessageDTO } from "@finance/shared";
import { api } from "../lib/api";
import { MarkdownMessage } from "../components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const status = useQuery({
    queryKey: ["chat-status"],
    queryFn: () => api.get<{ configured: boolean }>("/api/chat/status"),
  });

  const history = useQuery({
    queryKey: ["chat-messages"],
    queryFn: () => api.get<ChatMessageDTO[]>("/api/chat/messages"),
  });

  useEffect(() => {
    if (history.data) {
      setMessages(
        history.data.map((m) => ({ role: m.role, content: m.content })),
      );
    }
  }, [history.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao falar com a IA");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let totalBytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value?.length ?? 0;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
      if (totalBytes === 0) {
        throw new Error("A IA retornou resposta vazia. Verifique a chave e o modelo no .env.");
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro inesperado",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-800">Assistente</h1>
        <p className="text-sm text-slate-500">
          Converse sobre suas finanças. A IA usa os dados das contas conectadas.
        </p>
      </div>

      {status.data && !status.data.configured && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A IA não está configurada no servidor. Defina o provider e a respectiva
          chave de API no arquivo <code>.env</code>.
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Faça uma pergunta, ex: "Como estão meus gastos este mês?"
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
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
                m.content ? (
                  <MarkdownMessage content={m.content} />
                ) : streaming ? (
                  <span className="text-slate-400">...</span>
                ) : null
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={streaming}
          className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
