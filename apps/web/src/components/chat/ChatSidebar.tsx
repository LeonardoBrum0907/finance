import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatThreadDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { useState } from "react";

interface Props {
  activeThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  disabled?: boolean;
}

export function ChatSidebar({ activeThreadId, onSelectThread, disabled }: Props) {
  const queryClient = useQueryClient();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const threads = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => api.get<ChatThreadDTO[]>("/api/chat/threads"),
  });

  const createThread = useMutation({
    mutationFn: () => api.post<ChatThreadDTO>("/api/chat/threads"),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      onSelectThread(thread.id);
      setMobileOpen(false);
    },
  });

  const updateThread = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<ChatThreadDTO>(`/api/chat/threads/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      setEditingId(null);
    },
  });

  const deleteThread = useMutation({
    mutationFn: (id: string) => api.delete(`/api/chat/threads/${id}`),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      if (activeThreadId === deletedId) {
        const remaining = threads.data?.filter((t) => t.id !== deletedId);
        onSelectThread(remaining?.[0]?.id ?? null);
      }
    },
  });

  function startEdit(thread: ChatThreadDTO) {
    setEditingId(thread.id);
    setEditTitle(thread.title);
  }

  function saveEdit(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    updateThread.mutate({ id, title });
  }

  const expandedContent = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => createThread.mutate()}
          disabled={disabled || createThread.isPending}
          className="min-w-0 flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Nova conversa
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden shrink-0 rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 md:inline-flex"
          title="Recolher conversas"
          aria-label="Recolher conversas"
        >
          ‹
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {threads.isLoading && (
          <p className="px-2 text-xs text-slate-400">Carregando...</p>
        )}
        {threads.data?.map((thread) => (
          <div
            key={thread.id}
            className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${
              activeThreadId === thread.id ? "bg-brand-50" : "hover:bg-slate-100"
            }`}
          >
            {editingId === thread.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => saveEdit(thread.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(thread.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-0.5 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSelectThread(thread.id);
                  setMobileOpen(false);
                }}
                onDoubleClick={() => startEdit(thread)}
                disabled={disabled}
                className="min-w-0 flex-1 truncate text-left text-sm text-slate-700"
                title={thread.title}
              >
                {thread.title}
              </button>
            )}
            <button
              type="button"
              onClick={() => startEdit(thread)}
              disabled={disabled}
              className="hidden rounded p-1 text-slate-400 hover:text-slate-600 group-hover:inline"
              title="Renomear"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Excluir esta conversa?")) deleteThread.mutate(thread.id);
              }}
              disabled={disabled}
              className="hidden rounded p-1 text-slate-400 hover:text-red-600 group-hover:inline"
              title="Excluir"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );

  const collapsedContent = (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
        title="Expandir conversas"
        aria-label="Expandir conversas"
      >
        ›
      </button>
      <button
        type="button"
        onClick={() => createThread.mutate()}
        disabled={disabled || createThread.isPending}
        className="rounded-md bg-brand-600 p-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        title="Nova conversa"
        aria-label="Nova conversa"
      >
        +
      </button>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="mb-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? "Fechar conversas" : "Conversas"}
      </button>
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } shrink-0 border-slate-200 md:flex md:h-full md:min-h-0 md:flex-col ${
          collapsed ? "md:w-12 md:border-r md:px-1 md:py-1" : "md:w-56 md:border-r md:pr-3"
        } w-full`}
      >
        <div className="hidden h-full min-h-0 flex-col overflow-hidden md:flex">
          {collapsed ? collapsedContent : expandedContent}
        </div>
        <div className="flex h-full min-h-0 flex-col overflow-hidden md:hidden">{expandedContent}</div>
      </aside>
    </>
  );
}
