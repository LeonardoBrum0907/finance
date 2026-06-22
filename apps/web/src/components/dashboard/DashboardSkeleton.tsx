import { cardClass, cardLargeClass } from "./motion";

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
    <div className="space-y-8" aria-busy aria-label="Carregando painel">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cardClass}>
            <SkeletonBar className="h-4 w-24" />
            <SkeletonBar className="mt-3 h-8 w-36" />
            <SkeletonBar className="mt-3 h-5 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className={`${cardLargeClass} lg:col-span-2`}>
          <SkeletonBar className="h-5 w-48" />
          <SkeletonBar className="mt-2 h-4 w-56" />
          <SkeletonBar className="mt-6 h-64 w-full" />
        </div>
        <div className={cardLargeClass}>
          <SkeletonBar className="h-5 w-44" />
          <SkeletonBar className="mt-2 h-4 w-48" />
          <SkeletonBar className="mt-6 h-44 w-full max-w-[180px] mx-auto" />
          <div className="mt-6 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBar key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className={cardLargeClass}>
          <SkeletonBar className="h-5 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBar key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className={cardLargeClass}>
          <SkeletonBar className="h-5 w-36" />
          <SkeletonBar className="mt-4 h-32 w-full rounded-2xl" />
        </div>
      </div>

      <div className={`${cardLargeClass} overflow-hidden p-0`}>
        <div className="border-b border-slate-100 p-6">
          <SkeletonBar className="h-5 w-44" />
          <SkeletonBar className="mt-2 h-4 w-64" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBar key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
