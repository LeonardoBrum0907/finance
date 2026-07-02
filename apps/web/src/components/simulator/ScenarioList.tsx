import { Plus } from "lucide-react";
import type { SimulationScenarioDTO } from "@finance/shared";
import { ScenarioCard } from "./ScenarioCard";

type TabKey = "active" | "draft" | "history";

interface Props {
  scenarios: SimulationScenarioDTO[];
  currencyCode: string;
  tab: TabKey;
  highlightId?: string | null;
  onTabChange: (tab: TabKey) => void;
  onNew: () => void;
  onRun: (id: string) => void;
  onEdit: (scenario: SimulationScenarioDTO) => void;
  onToggleActive: (scenario: SimulationScenarioDTO) => void;
  onComplete: (scenario: SimulationScenarioDTO) => void;
  onConvert: (scenario: SimulationScenarioDTO) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "draft", label: "Rascunhos" },
  { key: "history", label: "Concluídos" },
];

export function ScenarioList({
  scenarios,
  currencyCode,
  tab,
  highlightId,
  onTabChange,
  onNew,
  onRun,
  onEdit,
  onToggleActive,
  onComplete,
  onConvert,
  onArchive,
  onDelete,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-app-border bg-app-bg/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-app-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo cenário
        </button>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border/80 bg-app-surface/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {tab === "active"
              ? "Nenhum cenário ativo"
              : tab === "draft"
                ? "Nenhum rascunho salvo"
                : "Nenhum cenário concluído ainda"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie compras, despesas, poupança ou investimentos simulados e veja o impacto nos ciclos.
          </p>
          {tab !== "history" && (
            <button
              type="button"
              onClick={onNew}
              className="mt-4 cursor-pointer rounded-xl border border-brand/30 bg-brand/5 px-4 py-2 text-xs font-semibold text-brand hover:bg-brand/10"
            >
              Criar primeiro cenário
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              currencyCode={currencyCode}
              highlighted={highlightId === scenario.id}
              onRun={onRun}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onComplete={onComplete}
              onConvert={onConvert}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export type { TabKey as ScenarioListTab };
