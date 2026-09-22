/**
 * Simplified transonic/supersonic drag-rise model.
 * Returns a multiplier applied to a rocket's base (subsonic) drag coefficient as a function
 * of Mach number. Captures the well-known drag-coefficient "hump" near Mach 1 caused by
 * wave drag, then the gradual relaxation at higher supersonic/hypersonic speeds.
 */
export function machDragMultiplier(mach: number): number {
  const m = Math.max(mach, 0)
  if (m < 0.8) return 1.0
  if (m < 1.05) {
    // Steep transonic rise from 1.0x to a peak of ~1.85x
    const frac = (m - 0.8) / (1.05 - 0.8)
    return 1.0 + frac * 0.85
  }
  if (m < 1.3) {
    // Short plateau just past Mach 1, then begin relaxing
    const frac = (m - 1.05) / (1.3 - 1.05)
    return 1.85 - frac * 0.25
  }
  if (m < 5) {
    // Gradual supersonic relaxation down toward ~0.9x
    const frac = (m - 1.3) / (5 - 1.3)
    return 1.6 - frac * 0.7
  }
  return 0.9
}

/** Effective drag coefficient given a rocket's subsonic base Cd and current Mach number. */
export function dragCoefficient(mach: number, baseCd: number): number {
  return baseCd * machDragMultiplier(mach)
}

/** Dynamic pressure q = 1/2 * rho * v^2 (Pa). The central quantity of aerodynamic loading. */
export function dynamicPressure(density: number, speed: number): number {
  return 0.5 * density * speed * speed
}

/** Magnitude of aerodynamic drag force (N), opposing the velocity vector. */
export function dragForceMagnitude(density: number, speed: number, cd: number, area: number): number {
  return dynamicPressure(density, speed) * cd * area
}
