import { useEffect, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  MoreVertical,
  Play,
  Target,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { SimulationScenarioDTO } from "@finance/shared";
import { scenarioStatusLabel, scenarioTypeLabel } from "@finance/shared";
import { formatCurrency } from "../../lib/format";
import { cardClass } from "../dashboard/motion";

const VERDICT_BADGE: Record<string, string> = {
  affordable: "bg-positive/10 text-positive border-positive/20",
  caution: "bg-amber-50 text-amber-800 border-amber-200",
  risky: "bg-negative/10 text-negative border-negative/20",
};

const VERDICT_LABEL: Record<string, string> = {
  affordable: "Viável",
  caution: "Atenção",
  risky: "Arriscado",
};

interface Props {
  scenario: SimulationScenarioDTO;
  currencyCode: string;
  highlighted?: boolean;
  onRun: (id: string) => void;
  onEdit: (scenario: SimulationScenarioDTO) => void;
  onToggleActive: (scenario: SimulationScenarioDTO) => void;
  onComplete: (scenario: SimulationScenarioDTO) => void;
  onConvert: (scenario: SimulationScenarioDTO) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ScenarioCard({
  scenario,
  currencyCode,
  highlighted,
  onRun,
  onEdit,
  onToggleActive,
  onComplete,
  onConvert,
  onArchive,
  onDelete,
}: Props) {
  const amount = scenario.payload.amount;
  const canComplete = scenario.status === "active" || scenario.status === "draft";
  const canConvert =
    scenario.status === "active" &&
    scenario.type !== "recurring_expense" &&
    !scenario.linkedGoalId;
  const canActivate = scenario.status === "draft";
  const canDeactivate = scenario.status === "active";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function runMenuAction(action: () => void) {
    action();
    closeMenu();
  }

  return (
    <article
      className={`${cardClass} ${highlighted ? "ring-2 ring-brand/40" : ""} p-4 transition`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-sm font-semibold text-foreground">
              {scenario.name}
            </p>
            {scenario.lastVerdict && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${VERDICT_BADGE[scenario.lastVerdict] ?? "border-app-border text-muted-foreground"}`}
              >
                {VERDICT_LABEL[scenario.lastVerdict] ?? scenario.lastVerdict}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {scenarioTypeLabel(scenario.type)} · {scenarioStatusLabel(scenario.status)}
            {scenario.personName ? ` · ${scenario.personName}` : ""}
          </p>
          <p className="mt-2 font-display text-lg font-bold text-foreground">
            {formatCurrency(amount, currencyCode)}
          </p>
          {scenario.linkedGoalName && (
            <p className="mt-1 text-xs text-brand">Meta: {scenario.linkedGoalName}</p>
          )}
          {scenario.completedAt && (
            <p className="mt-1 text-xs text-positive">
              Concluído em {new Date(scenario.completedAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex cursor-pointer items-center rounded-lg border border-app-border p-1.5 text-muted-foreground hover:bg-app-bg"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-xl border border-app-border bg-app-surface py-1 shadow-lg">
              {(canActivate || canDeactivate) && (
                <MenuButton
                  icon={canActivate ? ToggleRight : ToggleLeft}
                  label={canActivate ? "Ativar" : "Desativar"}
                  onClick={() => runMenuAction(() => onToggleActive(scenario))}
                />
              )}
              <MenuButton
                icon={Play}
                label="Analisar"
                onClick={() => runMenuAction(() => onRun(scenario.id))}
              />
              {canComplete && scenario.type !== "save_for_goal" && (
                <MenuButton
                  icon={CheckCircle2}
                  label="Marcar realizada"
                  onClick={() => runMenuAction(() => onComplete(scenario))}
                />
              )}
              {canConvert && (
                <MenuButton
                  icon={Target}
                  label="Virar meta"
                  onClick={() => runMenuAction(() => onConvert(scenario))}
                />
              )}
              <MenuButton
                icon={Archive}
                label="Arquivar"
                onClick={() => runMenuAction(() => onArchive(scenario.id))}
              />
              {scenario.status === "draft" && (
                <MenuButton
                  icon={Archive}
                  label="Excluir"
                  onClick={() => runMenuAction(() => onDelete(scenario.id))}
                  destructive
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(scenario)}
          className="cursor-pointer rounded-lg border border-app-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-app-bg"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onRun(scenario.id)}
          className="cursor-pointer rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
        >
          Ver análise
        </button>
      </div>
    </article>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-app-bg ${
        destructive ? "text-negative" : "text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
