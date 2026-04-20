import { Skeleton } from '@/components/ui/Skeleton'

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 pb-20 animate-fade-in">
      {/* Header Hero Skeleton */}
      <section className="rounded-[28px] p-8 bg-slate-900 shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-8">
          <div className="flex flex-col gap-5">
            <Skeleton className="h-6 w-40 rounded-full bg-slate-800" />
            <Skeleton className="h-10 w-3/4 bg-slate-800" />
            <Skeleton className="h-4 w-2/3 bg-slate-800" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl p-4 bg-slate-800">
                  <Skeleton className="h-3 w-20 mb-2 bg-slate-700" />
                  <Skeleton className="h-6 w-16 bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="rounded-[22px] p-6 bg-slate-800 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-3 w-20 mb-2 bg-slate-700" />
                <Skeleton className="h-5 w-32 bg-slate-700" />
              </div>
              <Skeleton className="w-[68px] h-[68px] rounded-full bg-slate-700" />
            </div>
            <Skeleton className="h-20 w-full rounded-2xl bg-slate-700" />
          </div>
        </div>
      </section>

      {/* Filters Skeleton */}
      <section className="rounded-3xl p-5 border border-[var(--border)] flex flex-col md:flex-row gap-5 justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
      </section>

      {/* Cards Skeleton */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[120px] rounded-[22px]" />
        ))}
      </section>

      {/* Advanced Widgets Skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[24px] p-6 border border-[var(--border)] flex flex-col min-h-[300px]">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="flex-1 flex flex-col gap-3">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
