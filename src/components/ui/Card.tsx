import type { PropsWithChildren, ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: PropsWithChildren<{ title?: string; subtitle?: string; action?: ReactNode; className?: string }>) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/20 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
