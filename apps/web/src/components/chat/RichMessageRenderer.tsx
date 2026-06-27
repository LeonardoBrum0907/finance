import type { ChatBlock } from "@finance/shared";

interface Props {
  blocks: ChatBlock[];
  onActionPrompt?: (message: string) => void;
}

export function RichMessageRenderer({ blocks, onActionPrompt }: Props) {
  if (blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-app-border/80 pt-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "metric":
            return (
              <div
                key={i}
                className="rounded-xl border border-app-border bg-app-surface px-3 py-2"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {block.label}
                </p>
                <p className="font-display text-lg font-semibold text-foreground">{block.value}</p>
                {block.delta && (
                  <p className="text-xs text-muted-foreground">{block.delta}</p>
                )}
              </div>
            );

          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-app-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-app-border bg-app-bg">
                      {block.headers.map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-app-border/60 last:border-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-foreground/90">
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
                <div key={i} className="space-y-2 rounded-xl border border-app-border bg-app-surface p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Gastos por categoria
                  </p>
                  {block.data.map((item) => (
                    <div key={item.category}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-foreground/90">{item.category}</span>
                        <span className="font-medium text-foreground">
                          {item.formattedTotal}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-positive"
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
