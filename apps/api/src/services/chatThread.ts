import { prisma } from "../prisma.js";
import type { ChatThread } from "@prisma/client";

const DEFAULT_TITLE = "Nova conversa";

export async function findUserThread(userId: string, threadId: string) {
  return prisma.chatThread.findFirst({
    where: { id: threadId, userId },
  });
}

export async function findOrCreateThread(
  userId: string,
  opts: { contextKey: string; title: string },
): Promise<ChatThread> {
  const existing = await prisma.chatThread.findFirst({
    where: { userId, contextKey: opts.contextKey },
  });
  if (existing) return existing;
  return prisma.chatThread.create({
    data: {
      userId,
      contextKey: opts.contextKey,
      title: opts.title,
    },
  });
}

export function serializeThread(thread: ChatThread) {
  return {
    id: thread.id,
    title: thread.title,
    contextKey: thread.contextKey,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

export async function touchThread(threadId: string) {
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });
}

export async function autoTitleFromFirstMessage(threadId: string, userText: string) {
  const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.title !== DEFAULT_TITLE) return;

  const title =
    userText.length > 60 ? `${userText.slice(0, 60).trim()}…` : userText.trim();

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { title: title || DEFAULT_TITLE },
  });
}

export async function resetThreadTitle(threadId: string) {
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { title: DEFAULT_TITLE, updatedAt: new Date() },
  });
}

export { DEFAULT_TITLE };
