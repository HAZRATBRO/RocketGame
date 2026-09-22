export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—'
  const abs = Math.abs(meters)
  if (abs >= 1000) return `${formatNumber(meters / 1000, 2)} km`
  return `${formatNumber(meters, 1)} m`
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  if (m === 0) return `${s.toFixed(1)} s`
  return `${m}m ${s.toFixed(1)}s`
}

export function formatSpeed(mps: number): string {
  return `${formatNumber(mps, 1)} m/s`
}
