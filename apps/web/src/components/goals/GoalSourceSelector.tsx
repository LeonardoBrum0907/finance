import { useEffect, useMemo, useState } from "react";
import type { AvailableGoalSourceDTO, GoalSourceDTO } from "@finance/shared";
import { formatCurrency } from "../../lib/format";

export interface GoalSourceSelection {
  sourceType: "account" | "investment";
  accountId?: string;
  investmentId?: string;
  allocationPercent: number;
}

interface Props {
  availableSources: AvailableGoalSourceDTO[];
  initialSources?: GoalSourceDTO[];
  currencyCode?: string;
  onChange: (sources: GoalSourceSelection[]) => void;
}

function sourceKey(source: { sourceType: string; accountId?: string | null; investmentId?: string | null }) {
  return source.sourceType === "account"
    ? `account:${source.accountId}`
    : `investment:${source.investmentId}`;
}

/** Referência estável — evita reset do useEffect quando initialSources não é passado (modal criar). */
const EMPTY_INITIAL_SOURCES: GoalSourceDTO[] = [];

export function GoalSourceSelector({
  availableSources,
  initialSources,
  currencyCode = "BRL",
  onChange,
}: Props) {
  const resolvedInitialSources = initialSources ?? EMPTY_INITIAL_SOURCES;
  const [selected, setSelected] = useState<Map<string, GoalSourceSelection>>(new Map());

  useEffect(() => {
    const map = new Map<string, GoalSourceSelection>();
    for (const src of resolvedInitialSources) {
      const key = sourceKey(src);
      map.set(key, {
        sourceType: src.sourceType,
        accountId: src.accountId ?? undefined,
        investmentId: src.investmentId ?? undefined,
        allocationPercent: src.allocationPercent,
      });
    }
    setSelected(map);
  }, [resolvedInitialSources]);

  useEffect(() => {
    onChange([...selected.values()]);
  }, [selected, onChange]);

  const selectableSources = useMemo(
    () => availableSources.filter((s) => !s.isCredit && (s.availablePercent > 0 || selected.has(sourceKey(s)))),
    [availableSources, selected],
  );

  if (availableSources.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        Conecte contas ou investimentos em Contas para vincular ao objetivo.
      </p>
    );
  }

  function toggleSource(item: AvailableGoalSourceDTO) {
    const key = sourceKey(item);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          sourceType: item.sourceType,
          accountId: item.accountId ?? undefined,
          investmentId: item.investmentId ?? undefined,
          allocationPercent: Math.min(100, item.availablePercent || 100),
        });
      }
      return next;
    });
  }

  function updatePercent(key: string, value: number) {
    setSelected((prev) => {
      const current = prev.get(key);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(key, { ...current, allocationPercent: value });
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        Vincular ao saldo real
      </p>
      <p className="text-xs text-slate-500">
        Selecione contas ou investimentos. O progresso será calculado automaticamente pelos saldos.
      </p>
      <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
        {selectableSources.map((item) => {
          const key = sourceKey(item);
          const isSelected = selected.has(key);
          const selection = selected.get(key);
          const maxPercent = isSelected
            ? (item.usedPercent - (resolvedInitialSources.find((s) => sourceKey(s) === key)?.allocationPercent ?? 0)) +
              item.availablePercent
            : item.availablePercent;

          return (
            <li
              key={key}
              className={`rounded-lg border px-3 py-2 ${
                isSelected ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-white"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSource(item)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{item.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {item.sourceLabel} · {formatCurrency(item.balance, currencyCode)}
                    {item.isStale ? " · dado possivelmente desatualizado" : ""}
                  </p>
                  {!isSelected && item.availablePercent < 100 && (
                    <p className="text-[10px] text-amber-600">
                      {item.availablePercent.toFixed(0)}% disponível ({item.usedPercent.toFixed(0)}% em outros objetivos)
                    </p>
                  )}
                </div>
              </label>
              {isSelected && selection && (
                <div className="mt-2 flex items-center gap-2 pl-6">
                  <label className="text-[10px] text-slate-500">Alocação</label>
                  <input
                    type="number"
                    min={0.01}
                    max={Math.max(0.01, maxPercent)}
                    step={0.01}
                    value={selection.allocationPercent}
                    onChange={(e) =>
                      updatePercent(key, Math.min(maxPercent, Math.max(0.01, Number(e.target.value) || 0)))
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">%</span>
                  <span className="ml-auto text-[10px] font-medium text-emerald-700">
                    {formatCurrency(item.balance * (selection.allocationPercent / 100), currencyCode)}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function previewAllocatedTotal(
  sources: GoalSourceSelection[],
  availableSources: AvailableGoalSourceDTO[],
): number {
  let total = 0;
  for (const src of sources) {
    const key = sourceKey(src);
    const item = availableSources.find((s) => sourceKey(s) === key);
    if (item) total += item.balance * (src.allocationPercent / 100);
  }
  return Math.round(total * 100) / 100;
}
