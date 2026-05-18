import { Skeleton } from '@/components/ui/Skeleton'

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-5 pb-20 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-64 opacity-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[96px] rounded-[20px]" />
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="rounded-[20px] p-5 border border-[var(--border)] flex flex-col gap-3 min-h-[220px]"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40 opacity-40" />
            <div className="flex flex-col gap-2 mt-2">
              {[1, 2, 3, 4].map(j => (
                <Skeleton key={j} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
