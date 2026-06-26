import type { ChatMessageMetadata } from "@finance/shared";
import { computeProposalImpact, serializeProposal } from "./chatProposal.js";

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
  proposal?: {
    id: string;
    type: string;
    payload: unknown;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  } | null;
}) {
  const metadata = serializeMessageMetadata(m.metadata);
  const impactSummary = m.proposal
    ? computeProposalImpact(m.proposal.type, m.proposal.payload)
    : undefined;

  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    ...(metadata ? { metadata } : {}),
    ...(m.proposal
      ? {
          proposal: {
            ...serializeProposal(m.proposal),
            ...(impactSummary ? { impactSummary } : {}),
          },
        }
      : {}),
  };
}
