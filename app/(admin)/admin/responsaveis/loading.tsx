import { Skeleton } from '@/components/ui/Skeleton'

export default function ResponsaveisLoading() {
  return (
    <div className="flex flex-col gap-5 pb-20 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-72 opacity-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] p-4 flex flex-wrap gap-3">
        <Skeleton className="h-10 flex-1 min-w-[220px] rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr_0.6fr] gap-3 px-5 py-3 border-b border-[var(--border)]">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-3 opacity-40" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(row => (
          <div
            key={row}
            className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr_0.6fr] gap-3 px-5 py-4 border-b border-[var(--border)] last:border-b-0 items-center"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  )
}
