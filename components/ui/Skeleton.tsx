import React from 'react'

export function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--border-strong)] opacity-50 ${className}`}
      {...props}
    />
  )
}
