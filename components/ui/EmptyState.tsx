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
    <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--surface)] border-[1.5px] border-[var(--border)] rounded-[var(--r-xl)] shadow-sm animate-fade-up">
      <div className="text-6xl mb-5 opacity-80 filter drop-shadow-sm">{icon}</div>
      <h3 className="text-lg font-black text-[var(--text-1)] mb-2 tracking-tight">{title}</h3>
      <p className="text-[13px] text-[var(--text-3)] max-w-sm mx-auto mb-6 leading-relaxed font-medium">
        {description}
      </p>
      
      {actionHref && actionLabel && (
        <Link 
          href={actionHref}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--brand)] text-white font-bold text-[13px] no-underline hover:-translate-y-0.5 transition-transform shadow-sm"
        >
          {actionLabel}
        </Link>
      )}
      
      {actionOnClick && actionLabel && !actionHref && (
        <button 
          onClick={actionOnClick}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--brand)] text-white font-bold text-[13px] border-none cursor-pointer hover:-translate-y-0.5 transition-transform shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
