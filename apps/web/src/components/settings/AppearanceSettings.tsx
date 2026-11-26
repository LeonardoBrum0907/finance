import { useState } from "react";
import type { AppTheme } from "@finance/shared";
import { useTheme } from "../../lib/theme/useTheme";

const THEMES = [
  {
    id: "default" as const,
    label: "Padrão",
    description: "Verdes vibrantes e contraste nítido.",
    swatches: ["bg-app-bg", "bg-positive", "bg-negative"],
  },
  {
    id: "comfy" as const,
    label: "Comfy",
    description: "Tons pastéis, off-white e negativos em cinza suave.",
    swatches: ["bg-[#faf9f6]", "bg-[#a7d7c5]", "bg-[#94a3b8]"],
  },
];

export function AppearanceSettings() {
  const { theme, setTheme, isLoading } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: AppTheme) => {
    if (next === theme) return;
    setError(null);
    setSaving(true);
    try {
      await setTheme(next);
    } catch (err) {
      setError((err as Error).message ?? "Erro ao salvar o tema.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isLoading || saving}
              onClick={() => void choose(option.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-brand bg-brand/5 shadow-sm"
                  : "border-app-border bg-app-surface hover:border-app-border/80"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="mb-3 flex gap-2">
                {option.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className={`h-6 w-6 rounded-full border border-app-border/60 ${swatch}`}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold text-foreground">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
