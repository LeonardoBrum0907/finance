import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NavigableCycle } from "@finance/shared";

interface Props {
  cycles: NavigableCycle[];
  selectedCycleKey: string;
  onSelectCycle: (cycleKey: string) => void;
}

function cycleStatusLabel(cycle: NavigableCycle): string {
  if (cycle.isCurrent) return "Ciclo atual";
  if (cycle.isFuture) return "Projeção";
  if (cycle.isComplete) return "Ciclo encerrado";
  return "Ciclo";
}

export function CycleNavigator({ cycles, selectedCycleKey, onSelectCycle }: Props) {
  const currentIndex = cycles.findIndex((c) => c.cycleKey === selectedCycleKey);
  const selected = currentIndex >= 0 ? cycles[currentIndex]! : cycles[cycles.length - 2];
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < cycles.length - 1;

  if (!selected || cycles.length === 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg p-1"
      role="group"
      aria-label="Navegar entre ciclos"
    >
      <button
        type="button"
        disabled={!canGoBack}
        onClick={() => canGoBack && onSelectCycle(cycles[currentIndex - 1]!.cycleKey)}
        className="rounded-md p-1.5 text-muted-foreground-dark transition hover:bg-app-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Ciclo anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="min-w-[10rem] px-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {cycleStatusLabel(selected)}
        </p>
        <p className="text-sm font-medium text-foreground">{selected.label}</p>
      </div>

      <button
        type="button"
        disabled={!canGoForward}
        onClick={() => canGoForward && onSelectCycle(cycles[currentIndex + 1]!.cycleKey)}
        className="rounded-md p-1.5 text-muted-foreground-dark transition hover:bg-app-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Próximo ciclo"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
