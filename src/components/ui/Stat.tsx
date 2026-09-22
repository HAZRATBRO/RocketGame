export function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: 'orange' | 'sky' | 'emerald' | 'rose' }) {
  const accentClass =
    accent === 'orange'
      ? 'text-orange-400'
      : accent === 'sky'
        ? 'text-sky-400'
        : accent === 'emerald'
          ? 'text-emerald-400'
          : accent === 'rose'
            ? 'text-rose-400'
            : 'text-slate-100'
  return (
    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${accentClass}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </div>
    </div>
  )
}
