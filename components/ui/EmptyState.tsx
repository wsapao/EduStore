import Link from 'next/link'
import React from 'react'

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  actionOnClick
}: {
  icon: string | React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  actionOnClick?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fadeUp">
      <div className="w-24 h-24 bg-[#f8f9fd] rounded-full flex items-center justify-center mb-4">
        <div className="text-[42px] opacity-40">{icon}</div>
      </div>
      <h3 className="text-[16px] font-[800] text-[#0a1628] mb-2 tracking-tight">{title}</h3>
      <p className="text-[13px] text-[#6b7280] max-w-[260px] mx-auto mb-6 leading-[1.6] font-medium">
        {description}
      </p>
      
      {actionHref && actionLabel && (
        <Link 
          href={actionHref}
          className="inline-flex items-center justify-center gap-2 px-6 h-[46px] rounded-[13px] bg-[#f8f9fd] text-[#0a1628] font-[800] text-[13px] border border-black/5 no-underline active:scale-95 transition-transform"
        >
          {actionLabel}
        </Link>
      )}
      
      {actionOnClick && actionLabel && !actionHref && (
        <button 
          onClick={actionOnClick}
          className="inline-flex items-center justify-center gap-2 px-6 h-[46px] rounded-[13px] bg-[#f8f9fd] text-[#0a1628] font-[800] text-[13px] border border-black/5 cursor-pointer active:scale-95 transition-transform"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
