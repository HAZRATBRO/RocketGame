/** Configures a canvas's backing resolution for crisp rendering on high-DPI displays. */
export function setupHiDPICanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(cssWidth * dpr))
  canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/** Finds the sample interpolation index/fraction for a given time within a sorted `t` array. */
export function findTimeIndex<T extends { t: number }>(samples: T[], time: number): { index: number; frac: number } {
  if (samples.length === 0) return { index: 0, frac: 0 }
  if (time <= samples[0].t) return { index: 0, frac: 0 }
  if (time >= samples[samples.length - 1].t) return { index: samples.length - 2 >= 0 ? samples.length - 2 : 0, frac: 1 }
  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= time) lo = mid
    else hi = mid
  }
  const span = samples[hi].t - samples[lo].t
  const frac = span > 0 ? (time - samples[lo].t) / span : 0
  return { index: lo, frac }
}

export function lerp(a: number, b: number, frac: number): number {
  return a + (b - a) * frac
}
