import type { ChatAiQuotaDTO } from "@finance/shared";
import { formatAiQuotaLabel } from "../../hooks/useChatQuota";
import { formatDate } from "../../lib/format";

interface Props {
  quota: ChatAiQuotaDTO | undefined;
  isExhausted: boolean;
  isLow: boolean;
}

export function ChatQuotaBar({ quota, isExhausted, isLow }: Props) {
  if (!quota) return null;

  const ratio = quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  let message = formatAiQuotaLabel(quota);
  if (isExhausted) {
    message = `Limite mensal de IA atingido. Renova em ${formatDate(quota.resetsAt)}.`;
  } else if (isLow) {
    message = `${formatAiQuotaLabel(quota)} — restam poucos tokens este mês.`;
  }

  const barColor = isExhausted ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-brand";

  return (
    <div
      className={`mt-2 rounded-md border px-3 py-2 text-xs ${
        isExhausted
          ? "border-red-200 bg-red-50 text-red-800"
          : isLow
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-app-border bg-app-bg text-muted-foreground-dark"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{message}</span>
        {!isExhausted && (
          <span className="shrink-0 tabular-nums">{Math.round(ratio)}%</span>
        )}
      </div>
      {!isExhausted && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-app-border/60">
          <div className={`h-full ${barColor}`} style={{ width: `${ratio}%` }} />
        </div>
      )}
    </div>
  );
}
