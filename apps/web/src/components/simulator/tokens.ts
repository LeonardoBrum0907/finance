import type { SimulationType } from "@finance/shared";

export type SimulatorTone = "positive" | "negative" | "brand" | "neutral";

export const SIMULATOR_TONE: Record<
  SimulatorTone,
  { box: string; value: string; label: string; ring: string; hover: string }
> = {
  positive: {
    box: "border-positive/25 bg-positive/10",
    value: "text-positive",
    label: "text-positive/80",
    ring: "ring-positive/25",
    hover: "hover:border-positive/30 hover:bg-positive/5",
  },
  negative: {
    box: "border-negative/25 bg-negative/10",
    value: "text-negative",
    label: "text-negative/80",
    ring: "ring-negative/25",
    hover: "hover:border-negative/30 hover:bg-negative/5",
  },
  brand: {
    box: "border-brand/25 bg-brand/10",
    value: "text-brand",
    label: "text-brand/80",
    ring: "ring-brand/25",
    hover: "hover:border-brand/30 hover:bg-brand/5",
  },
  neutral: {
    box: "border-app-border/60 bg-app-bg/60",
    value: "text-foreground",
    label: "text-muted-foreground",
    ring: "ring-app-border/40",
    hover: "hover:border-app-border hover:bg-app-bg",
  },
};

export const SCENARIO_TYPE_TONE: Record<SimulationType, SimulatorTone> = {
  single_purchase: "positive",
  installments: "brand",
  recurring_expense: "negative",
  save_for_goal: "brand",
};

export function scenarioTypeButtonClass(type: SimulationType, selected: boolean): string {
  const tone = SCENARIO_TYPE_TONE[type];
  const styles = SIMULATOR_TONE[tone];
  if (selected) {
    return `${styles.box} border-opacity-100 ring-1 ${styles.ring}`;
  }
  return `border-app-border bg-app-surface ${styles.hover}`;
}
