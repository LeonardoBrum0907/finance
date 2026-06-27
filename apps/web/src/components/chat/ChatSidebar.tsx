import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatThreadDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { useState } from "react";

interface Props {
  activeThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  disabled?: boolean;
}

export function ChatSidebar({ activeThreadId, onSelectThread, disabled }: Props) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const bulkDeleteThreads = useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ deletedCount: number }>("/api/chat/threads/bulk-delete", { ids }),
    onSuccess: (_data, deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      if (activeThreadId && deletedIds.includes(activeThreadId)) {
        const remaining = threads.data?.filter((t) => !deletedIds.includes(t.id));
        onSelectThread(remaining?.[0]?.id ?? null);
      }
      exitSelectionMode();
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

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function enterSelectionMode() {
    setEditingId(null);
    setSelectionMode(true);
    setSelectedIds(new Set());
  }

  function toggleThreadSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = threads.data?.map((t) => t.id) ?? [];
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ok = await confirm({
      title: "Excluir conversas",
      message:
        count === 1
          ? "Excluir esta conversa selecionada?"
          : `Excluir ${count} conversas selecionadas?`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (ok) bulkDeleteThreads.mutate([...selectedIds]);
  }

  const allSelected =
    (threads.data?.length ?? 0) > 0 && selectedIds.size === threads.data!.length;

  const expandedContent = (
    <>
      <div className="mb-3 flex items-center gap-2">
        {selectionMode ? (
          <>
            <button
              type="button"
              onClick={exitSelectionMode}
              disabled={disabled || bulkDeleteThreads.isPending}
              className="min-w-0 flex-1 rounded-md border border-app-border px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-app-bg disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={disabled || selectedIds.size === 0 || bulkDeleteThreads.isPending}
              className="min-w-0 flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {bulkDeleteThreads.isPending
                ? "Excluindo..."
                : selectedIds.size > 0
                  ? `Excluir (${selectedIds.size})`
                  : "Excluir"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => createThread.mutate()}
              disabled={disabled || createThread.isPending}
              className="min-w-0 flex-1 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
            >
              Nova conversa
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden shrink-0 rounded-md border border-app-border p-2 text-muted-foreground-dark hover:bg-app-bg md:inline-flex"
              title="Recolher conversas"
              aria-label="Recolher conversas"
            >
              ‹
            </button>
          </>
        )}
      </div>

      {!selectionMode && (threads.data?.length ?? 0) > 0 && (
        <div className="mb-2">
          <button
            type="button"
            onClick={enterSelectionMode}
            disabled={disabled}
            className="w-full rounded-md border border-app-border px-3 py-1.5 text-xs font-medium text-muted-foreground-dark hover:bg-app-bg disabled:opacity-60"
          >
            Selecionar conversas
          </button>
        </div>
      )}

      {selectionMode && (threads.data?.length ?? 0) > 0 && (
        <label className="mb-2 flex cursor-pointer items-center gap-2 px-2 text-xs text-muted-foreground-dark">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={disabled || bulkDeleteThreads.isPending}
            className="rounded border-app-border text-brand focus:ring-brand-500"
          />
          Selecionar todas
        </label>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto">
        {threads.isLoading && (
          <p className="px-2 text-xs text-muted-foreground-dark">Carregando...</p>
        )}
        {threads.data?.map((thread) => (
          <div
            key={thread.id}
            className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${
              !selectionMode && activeThreadId === thread.id
                ? "bg-brand/10"
                : selectionMode && selectedIds.has(thread.id)
                  ? "bg-red-50"
                  : "hover:bg-slate-100"
            }`}
          >
            {selectionMode && (
              <input
                type="checkbox"
                checked={selectedIds.has(thread.id)}
                onChange={() => toggleThreadSelection(thread.id)}
                disabled={disabled || bulkDeleteThreads.isPending}
                className="shrink-0 rounded border-app-border text-brand focus:ring-brand-500"
                aria-label={`Selecionar ${thread.title}`}
              />
            )}

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
                className="min-w-0 flex-1 rounded border border-app-border px-1 py-0.5 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (selectionMode) {
                    toggleThreadSelection(thread.id);
                    return;
                  }
                  onSelectThread(thread.id);
                  setMobileOpen(false);
                }}
                onDoubleClick={() => !selectionMode && startEdit(thread)}
                disabled={disabled || bulkDeleteThreads.isPending}
                className="min-w-0 flex-1 truncate text-left text-sm text-foreground/90"
                title={thread.title}
              >
                {thread.title}
              </button>
            )}

            {!selectionMode && editingId !== thread.id && (
              <>
                <button
                  type="button"
                  onClick={() => startEdit(thread)}
                  disabled={disabled}
                  className="hidden rounded p-1 text-muted-foreground-dark hover:text-muted-foreground-dark group-hover:inline"
                  title="Renomear"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Excluir conversa",
                      message: "Excluir esta conversa?",
                      confirmLabel: "Excluir",
                      variant: "danger",
                    });
                    if (ok) deleteThread.mutate(thread.id);
                  }}
                  disabled={disabled}
                  className="hidden rounded p-1 text-muted-foreground-dark hover:text-danger group-hover:inline"
                  title="Excluir"
                >
                  ×
                </button>
              </>
            )}
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
        className="rounded-md border border-app-border p-2 text-muted-foreground-dark hover:bg-app-bg"
        title="Expandir conversas"
        aria-label="Expandir conversas"
      >
        ›
      </button>
      <button
        type="button"
        onClick={() => createThread.mutate()}
        disabled={disabled || createThread.isPending}
        className="rounded-md bg-brand p-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
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
        className="mb-2 rounded-md border border-app-border px-3 py-1.5 text-sm md:hidden"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? "Fechar conversas" : "Conversas"}
      </button>
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } shrink-0 border-app-border md:flex md:h-full md:min-h-0 md:flex-col ${
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
