import { Skeleton } from '@/components/ui/Skeleton'

export default function ConfiguracoesLoading() {
  return (
    <div className="flex flex-col gap-5 pb-20 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-72 opacity-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <aside className="rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-2 h-fit">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </aside>

        <div className="rounded-2xl border border-[var(--border)] p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-72 opacity-40" />
          </div>

          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map(field => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32 opacity-40" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
