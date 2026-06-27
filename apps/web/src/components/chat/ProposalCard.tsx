import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChatActionProposalDTO } from "@finance/shared";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

interface Props {
  proposal: ChatActionProposalDTO;
  threadId: string | null;
  onResolved?: () => Promise<void>;
}

const TYPE_LABELS: Record<ChatActionProposalDTO["type"], string> = {
  create_goal: "Criar objetivo",
  update_goal: "Editar objetivo",
  create_plan: "Criar plano",
  add_contribution: "Registrar aporte",
};

const STATUS_LABELS: Record<ChatActionProposalDTO["status"], string> = {
  pending: "",
  confirmed: "Confirmado",
  discarded: "Descartado",
};

function renderPayloadSummary(proposal: ChatActionProposalDTO): string {
  const p = proposal.payload;
  switch (proposal.type) {
    case "create_goal":
      return `"${String(p.name ?? "")}" — meta ${formatCurrency(Number(p.targetAmount ?? 0))}`;
    case "update_goal":
      return `Objetivo ${String(p.goalId ?? "").slice(0, 8)}…`;
    case "add_contribution":
      return `Aporte de ${formatCurrency(Number(p.amount ?? 0))}`;
    case "create_plan":
      return `"${String(p.name ?? "")}" — ${formatCurrency(Number(p.monthlyContribution ?? 0))}/mês`;
    default:
      return "Ação proposta pela IA";
  }
}

export function ProposalCard({ proposal, threadId, onResolved }: Props) {
  const queryClient = useQueryClient();

  const resolve = useMutation({
    mutationFn: (action: "confirm" | "discard") =>
      api.post<{ proposal: ChatActionProposalDTO }>(
        `/api/chat/proposals/${proposal.id}/${action}`,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      if (threadId) {
        await queryClient.invalidateQueries({ queryKey: ["chat-messages", threadId] });
      }
      await onResolved?.();
    },
  });

  const isResolved = proposal.status !== "pending";

  return (
    <div
      className={`mt-3 rounded-xl border p-4 ${
        proposal.status === "confirmed"
          ? "border-positive/30 bg-positive/10"
          : proposal.status === "discarded"
            ? "border-app-border bg-app-bg/80 opacity-70"
            : "border-positive/20 bg-positive/10"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-positive">
        {TYPE_LABELS[proposal.type]}
        {isResolved && (
          <span className="ml-2 text-muted-foreground">{STATUS_LABELS[proposal.status]}</span>
        )}
      </p>
      <p className="mt-1 text-sm text-foreground/90">{renderPayloadSummary(proposal)}</p>
      {proposal.impactSummary && (
        <p className="mt-1 text-xs text-positive">{proposal.impactSummary}</p>
      )}

      {proposal.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => resolve.mutate("confirm")}
            disabled={resolve.isPending}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => resolve.mutate("discard")}
            disabled={resolve.isPending}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-app-bg disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Descartar
          </button>
        </div>
      )}

      {proposal.status === "confirmed" &&
        (proposal.type === "create_goal" || proposal.type === "add_contribution") && (
          <Link
            to="/objetivos"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-positive hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Ver objetivos
          </Link>
        )}
    </div>
  );
}
