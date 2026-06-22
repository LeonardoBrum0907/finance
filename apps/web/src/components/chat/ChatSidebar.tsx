import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatThreadDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useState } from "react";

interface Props {
  activeThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  disabled?: boolean;
}

export function ChatSidebar({ activeThreadId, onSelectThread, disabled }: Props) {
  const queryClient = useQueryClient();
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

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={() => createThread.mutate()}
        disabled={disabled || createThread.isPending}
        className="mb-3 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        Nova conversa
      </button>
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
        } w-full shrink-0 border-slate-200 pr-0 md:block md:w-56 md:border-r md:pr-3`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
