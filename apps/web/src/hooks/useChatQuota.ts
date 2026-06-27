import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatAiQuotaDTO } from "@finance/shared";
import { api } from "../lib/api";

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function formatAiQuotaLabel(quota: ChatAiQuotaDTO): string {
  return `IA: ${formatTokenCount(quota.used)} / ${formatTokenCount(quota.limit)} tokens este mês`;
}

export function useChatQuota(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-quota"],
    queryFn: () => api.get<ChatAiQuotaDTO>("/api/chat/quota"),
    enabled,
    staleTime: 30_000,
  });

  const invalidateQuota = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["chat-quota"] });
  }, [queryClient]);

  const quota = query.data;
  const isExhausted = quota ? quota.remaining <= 0 : false;
  const isLow = quota ? quota.remaining > 0 && quota.remaining / quota.limit < 0.1 : false;

  return {
    quota,
    isExhausted,
    isLow,
    isLoading: query.isLoading,
    invalidateQuota,
    formatLabel: quota ? formatAiQuotaLabel(quota) : null,
  };
}
