import { BarChart3, ShoppingCart, Target } from "lucide-react";
import type { ChatContextSummaryDTO, ChatSuggestionDTO } from "@finance/shared";
import { ChatSuggestionChips } from "./ChatSuggestionChips";

interface Props {
  summary?: ChatContextSummaryDTO;
  suggestions: ChatSuggestionDTO[];
  onSelectIntent: (message: string) => void;
  disabled?: boolean;
}

const INTENTS = [
  {
    icon: BarChart3,
    title: "Analisar",
    message: "Como estão minhas finanças este mês? Mostre os números principais.",
    color: "sky",
  },
  {
    icon: Target,
    title: "Planejar meta",
    message: "Quero criar ou ajustar um objetivo financeiro. Me ajude a definir uma meta realista.",
    color: "emerald",
  },
  {
    icon: ShoppingCart,
    title: "Simular compra",
    message: "Quero simular uma compra — quanto posso gastar sem comprometer minhas metas?",
    color: "amber",
  },
] as const;

const colorMap = {
  sky: "border-sky-200 bg-sky-50/60 hover:bg-sky-50 text-sky-700",
  emerald: "border-positive/20 bg-positive/10 hover:bg-positive/15 text-positive",
  amber: "border-amber-200 bg-amber-50/60 hover:bg-amber-50 text-amber-700",
};

export function ChatEmptyState({ summary, suggestions, onSelectIntent, disabled }: Props) {
  return (
    <div className="py-4">
      <h2 className="text-base font-semibold text-foreground">
        O que você quer fazer com seu dinheiro?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha uma ação ou use uma sugestão abaixo.
      </p>

      {summary?.hasAccounts && (
        <p className="mt-3 rounded-lg bg-app-bg px-3 py-2 text-xs text-muted-foreground">
          {summary.balance && <>Saldo {summary.balance}</>}
          {summary.monthlyNet && <> · Sobra {summary.monthlyNet}</>}
          {summary.monthlyExpenses && <> · Gastos {summary.monthlyExpenses}</>}
          {summary.activeGoalsCount != null && summary.activeGoalsCount > 0 && (
            <> · {summary.activeGoalsCount} objetivo(s) ativo(s)</>
          )}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {INTENTS.map(({ icon: Icon, title, message, color }) => (
          <button
            key={title}
            type="button"
            disabled={disabled}
            onClick={() => onSelectIntent(message)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-60 ${colorMap[color]}`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-sm font-semibold">{title}</span>
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Sugestões para você
          </p>
          <ChatSuggestionChips
            suggestions={suggestions.map((s) => s.label)}
            onSelect={(label) => {
              const match = suggestions.find((s) => s.label === label);
              onSelectIntent(match?.message ?? label);
            }}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
