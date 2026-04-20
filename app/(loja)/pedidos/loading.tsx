import { Skeleton } from '@/components/ui/Skeleton'

export default function PedidosLoading() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 80px' }} className="animate-fade-in">
      {/* Header Skeleton */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        height: 60, padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Skeleton className="w-[36px] h-[36px] rounded-[var(--r-sm)] flex-shrink-0" />
        <Skeleton className="h-6 w-32" />
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[var(--surface-1)] border-[1.5px] border-[var(--border)] rounded-[var(--r-lg)] overflow-hidden">
            {/* Card Header */}
            <div className="p-[14px_16px] border-b border-[var(--border)] flex justify-between items-center">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-5 w-16" />
            </div>
            
            {/* Card Items */}
            <div className="p-[12px_16px] flex flex-col gap-[10px]">
              <div className="flex items-center gap-[12px]">
                <Skeleton className="w-[40px] h-[40px] rounded-[var(--r-sm)] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </div>

            {/* Card Footer */}
            <div className="p-[12px_16px] border-t border-[var(--border)] bg-[var(--surface-2)] flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
