import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatAiQuotaDTO, ChatMessageDTO } from "@finance/shared";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";

export type StreamingPhase = "thinking" | "streaming" | null;

interface UseChatStreamOptions {
  threadId: string | null;
  personId: string;
  enabled: boolean;
}

export function useChatStream({ threadId, personId, enabled }: UseChatStreamOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>(null);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messagesQueryKey = ["chat-messages", threadId] as const;

  useEffect(() => {
    if (!threadId || !enabled) {
      setMessages([]);
      setMessagesLoaded(false);
      return;
    }
    setMessagesLoaded(false);
    let cancelled = false;
    api
      .get<ChatMessageDTO[]>(`/api/chat/messages?threadId=${encodeURIComponent(threadId)}`)
      .then((data) => {
        if (!cancelled) {
          setMessages(data);
          setMessagesLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
          setMessagesLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, enabled]);

  const invalidateMessages = useCallback(async () => {
    if (!threadId) return;
    await queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    const data = await api.get<ChatMessageDTO[]>(
      `/api/chat/messages?threadId=${encodeURIComponent(threadId)}`,
    );
    setMessages(data);
  }, [threadId, queryClient, messagesQueryKey]);

  const consumeStream = useCallback(
    async (res: Response, optimisticAssistantId: string) => {
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          quota?: ChatAiQuotaDTO;
          retryAfterMs?: number;
        };

        if (res.status === 429) {
          if (data.quota) {
            await queryClient.setQueryData(["chat-quota"], data.quota);
            throw new Error(
              `Limite mensal de IA atingido. Renova em ${formatDate(data.quota.resetsAt)}.`,
            );
          }
          throw new Error(data.error ?? "Limite de uso atingido. Tente novamente em instantes.");
        }

        throw new Error(data.error ?? "Erro ao falar com a IA");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let totalBytes = 0;
      setStreamingPhase("thinking");
      setToolActivity("Consultando seus dados…");

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value?.length ?? 0;
        if (totalBytes > 0) {
          setStreamingPhase("streaming");
          setToolActivity(null);
        }
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticAssistantId
              ? { ...m, content: m.content + chunk }
              : m,
          ),
        );
      }

      if (totalBytes === 0) {
        throw new Error("A IA retornou resposta vazia. Verifique a chave e o modelo no .env.");
      }
    },
    [queryClient],
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text: string, contextHint?: string) => {
      if (!threadId || streaming || !text.trim()) return;

      const userMsg: ChatMessageDTO = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: ChatMessageDTO = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);
      setStreamingPhase("thinking");
      setToolActivity("Consultando seus dados…");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            threadId,
            ...(personId ? { personId } : {}),
            ...(contextHint ? { contextHint } : {}),
          }),
          signal: controller.signal,
        });
        await consumeStream(res, assistantMsg.id);
        await invalidateMessages();
        await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
        await queryClient.invalidateQueries({ queryKey: ["chat-quota"] });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: err instanceof Error ? err.message : "Erro inesperado",
                }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
        setStreamingPhase(null);
        setToolActivity(null);
        abortControllerRef.current = null;
      }
    },
    [threadId, personId, streaming, consumeStream, invalidateMessages, queryClient],
  );

  const regenerate = useCallback(async () => {
    if (!threadId || streaming) return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    const assistantMsg: ChatMessageDTO = {
      id: `temp-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);
    setStreaming(true);
    setStreamingPhase("thinking");
    setToolActivity("Consultando seus dados…");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat/regenerate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          ...(personId ? { personId } : {}),
        }),
        signal: controller.signal,
      });
      await consumeStream(res, assistantMsg.id);
      await invalidateMessages();
      await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-quota"] });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        await invalidateMessages();
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: err instanceof Error ? err.message : "Erro inesperado",
              }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      setStreamingPhase(null);
      setToolActivity(null);
      abortControllerRef.current = null;
    }
  }, [threadId, personId, streaming, messages, consumeStream, invalidateMessages, queryClient]);

  const clearConversation = useCallback(async () => {
    if (!threadId || streaming) return;
    await api.delete(`/api/chat/threads/${threadId}/messages`);
    setMessages([]);
    await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    await queryClient.invalidateQueries({ queryKey: messagesQueryKey });
  }, [threadId, streaming, queryClient, messagesQueryKey]);

  return {
    messages,
    messagesLoaded,
    streaming,
    streamingPhase,
    toolActivity,
    sendMessage,
    regenerate,
    clearConversation,
    stop,
    refetchMessages: invalidateMessages,
  };
}
