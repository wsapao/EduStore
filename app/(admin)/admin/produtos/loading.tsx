import { Skeleton } from '@/components/ui/Skeleton'

export default function ProdutosLoading() {
  return (
    <div className="flex flex-col gap-5 pb-20 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3 w-72 opacity-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] p-4 flex flex-wrap gap-3">
        <Skeleton className="h-10 flex-1 min-w-[220px] rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(card => (
          <div
            key={card}
            className="rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col"
          >
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2 opacity-40" />
              <div className="flex items-center justify-between mt-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
