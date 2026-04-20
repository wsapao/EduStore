import { Skeleton } from '@/components/ui/Skeleton'

export default function LojaLoading() {
  return (
    <div className="animate-fade-in flex flex-col gap-5">
      {/* ChildSelector Skeleton */}
      <div className="h-[60px] border-b border-[var(--border)] flex items-center px-5 gap-3">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      {/* Hero Section Skeleton */}
      <section className="px-5 pt-5">
        <Skeleton className="w-full h-[280px] rounded-[28px]" />
      </section>

      {/* Resumo Cards Skeleton */}
      <section className="px-5 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[120px] rounded-[22px]" />
          ))}
        </div>
      </section>

      {/* Ações Rápidas Skeleton */}
      <section className="px-5 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[140px] rounded-[22px]" />
          ))}
        </div>
      </section>

      {/* Search and Filters Skeleton */}
      <section className="px-5 pt-5">
        <Skeleton className="h-[60px] rounded-[20px]" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
      </section>

      {/* Products Grid Skeleton */}
      <section className="p-5">
        <div className="grid gap-14">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[160px] rounded-[20px]" />
          ))}
        </div>
      </section>
    </div>
  )
}
