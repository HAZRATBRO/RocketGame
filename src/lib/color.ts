export interface RGB {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  const bigint = Number.parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}
