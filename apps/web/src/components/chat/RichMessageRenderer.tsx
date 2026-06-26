import type { ChatBlock } from "@finance/shared";

interface Props {
  blocks: ChatBlock[];
  onActionPrompt?: (message: string) => void;
}

export function RichMessageRenderer({ blocks, onActionPrompt }: Props) {
  if (blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "metric":
            return (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {block.label}
                </p>
                <p className="font-display text-lg font-semibold text-slate-900">{block.value}</p>
                {block.delta && (
                  <p className="text-xs text-slate-500">{block.delta}</p>
                )}
              </div>
            );

          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {block.headers.map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold text-slate-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100 last:border-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-slate-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "chart":
            if (block.chartKind === "category_bar") {
              return (
                <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Gastos por categoria
                  </p>
                  {block.data.map((item) => (
                    <div key={item.category}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-slate-700">{item.category}</span>
                        <span className="font-medium text-slate-900">
                          {item.formattedTotal}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(item.percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            return null;

          case "action_prompt":
            return (
              <button
                key={i}
                type="button"
                onClick={() => onActionPrompt?.(block.message)}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-100"
              >
                {block.message}
              </button>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
