import { cardClass } from "./motion";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 ${className ?? ""}`}
      aria-hidden
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Carregando painel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBar className="h-7 w-32" />
          <SkeletonBar className="h-4 w-56" />
        </div>
        <SkeletonBar className="h-10 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cardClass}>
            <SkeletonBar className="h-4 w-24" />
            <SkeletonBar className="mt-3 h-8 w-36" />
            <SkeletonBar className="mt-3 h-5 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <SkeletonBar className="h-5 w-40" />
          <SkeletonBar className="mt-2 h-4 w-52" />
          <SkeletonBar className="mt-6 h-64 w-full" />
        </div>
        <div className={cardClass}>
          <SkeletonBar className="h-5 w-44" />
          <SkeletonBar className="mt-2 h-4 w-48" />
          <SkeletonBar className="mt-6 h-64 w-full" />
        </div>
      </div>

      <div className={cardClass}>
        <SkeletonBar className="h-5 w-24" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBar key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
