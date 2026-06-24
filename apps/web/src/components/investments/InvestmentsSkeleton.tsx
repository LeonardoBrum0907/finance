import { cardClass } from "../dashboard/motion";

export function InvestmentsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${cardClass} h-28`} />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className={`${cardClass} h-72`} />
        <div className={`${cardClass} h-72`} />
      </div>
      <div className={`${cardClass} h-96`} />
    </div>
  );
}
