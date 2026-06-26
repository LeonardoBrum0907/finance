import { api } from "../lib/api";
import type { ChatThreadDTO } from "@finance/shared";

export async function resolveChatThread(
  contextKey: string,
  title?: string,
): Promise<ChatThreadDTO> {
  return api.post<ChatThreadDTO>("/api/chat/threads/resolve", {
    contextKey,
    title,
  });
}

export async function createFreeChatThread(): Promise<ChatThreadDTO> {
  return api.post<ChatThreadDTO>("/api/chat/threads");
}
