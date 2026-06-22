import { prisma } from "../prisma.js";

const DEFAULT_TITLE = "Nova conversa";

export async function findUserThread(userId: string, threadId: string) {
  return prisma.chatThread.findFirst({
    where: { id: threadId, userId },
  });
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
