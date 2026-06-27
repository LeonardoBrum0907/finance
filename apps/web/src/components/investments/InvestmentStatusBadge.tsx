import type { InvestmentPositionDTO } from "@finance/shared";

export function investmentStatusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-positive/10 text-positive";
  }
  if (normalized === "PENDING") {
    return "bg-amber-500/10 text-amber-700";
  }
  if (normalized === "TOTAL_WITHDRAWAL") {
    return "bg-slate-200 text-muted-foreground";
  }
  return "bg-slate-100 text-muted-foreground";
}

interface Props {
  status: string;
  label: string;
}

export function InvestmentStatusBadge({ status, label }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${investmentStatusBadgeClass(status)}`}
    >
      {label}
    </span>
  );
}

export function PositionStatusCell({ position }: { position: InvestmentPositionDTO }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <InvestmentStatusBadge
        status={position.status}
        label={position.statusLabel}
      />
      {position.isStale && (
        <span
          className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
          title={
            position.referenceDate
              ? `Posição reportada em ${position.referenceDate}${
                  position.staleDays != null ? ` (${position.staleDays} dias atrás)` : ""
                }`
              : "Posição possivelmente desatualizada"
          }
        >
          Desatualizada
        </span>
      )}
    </div>
  );
}
