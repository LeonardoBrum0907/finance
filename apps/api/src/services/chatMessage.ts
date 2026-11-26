import type { ChatMessageMetadata } from "@finance/shared";

export function serializeMessageMetadata(metadata: unknown): ChatMessageMetadata | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  return metadata as ChatMessageMetadata;
}

export function serializeMessage(m: {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  metadata?: unknown;
}) {
  const metadata = serializeMessageMetadata(m.metadata);
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}
