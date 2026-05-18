import { Skeleton } from '@/components/ui/Skeleton'

export default function PedidosLoading() {
  return (
    <div className="flex flex-col gap-5 pb-20 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-64 opacity-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] p-4 flex flex-wrap gap-3">
        <Skeleton className="h-10 flex-1 min-w-[220px] rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5, 6].map(row => (
          <div
            key={row}
            className="rounded-2xl border border-[var(--border)] p-4 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-56 opacity-40" />
              <Skeleton className="h-3 w-40 opacity-40" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
