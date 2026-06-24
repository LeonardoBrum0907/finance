import type { InvestmentPositionDTO } from "@finance/shared";

export function investmentStatusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-emerald-500/10 text-emerald-700";
  }
  if (normalized === "PENDING") {
    return "bg-amber-500/10 text-amber-700";
  }
  if (normalized === "TOTAL_WITHDRAWAL") {
    return "bg-slate-200 text-slate-600";
  }
  return "bg-slate-100 text-slate-600";
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
    <InvestmentStatusBadge
      status={position.status}
      label={position.statusLabel}
    />
  );
}
