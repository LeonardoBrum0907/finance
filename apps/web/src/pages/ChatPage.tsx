import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatThreadDTO } from "@finance/shared";
import { api } from "../lib/api";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { ChatConversation } from "../components/chat/ChatConversation";

export function ChatPage() {
  const queryClient = useQueryClient();
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const initRef = useRef(false);

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
    if (threads.isLoading || activeThreadId || initRef.current) return;

    if (threads.data && threads.data.length > 0) {
      initRef.current = true;
      setActiveThreadId(threads.data[0]!.id);
      return;
    }

    if (threads.data && threads.data.length === 0 && !createThread.isPending) {
      initRef.current = true;
      createThread.mutate();
    }
  }, [threads.data, threads.isLoading, activeThreadId, createThread.isPending, createThread]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden md:flex-row md:gap-4 lg:h-[calc(100vh-4rem)]">
      <ChatSidebar
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatConversation
          activeThreadId={activeThreadId}
          onThreadChange={setActiveThreadId}
          selectedPersonId={selectedPersonId}
          onPersonChange={setSelectedPersonId}
          showHeader
          showPersonFilter
        />
      </div>
    </div>
  );
}
