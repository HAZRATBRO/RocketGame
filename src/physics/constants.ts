// Standard physical constants (SI units throughout the codebase)
export const G0 = 9.80665 // standard gravity, m/s^2
export const EARTH_RADIUS = 6_371_000 // mean radius, m
export const R_AIR = 287.05 // specific gas constant for dry air, J/(kg*K)
export const GAMMA_AIR = 1.4 // ratio of specific heats for air
export const SEA_LEVEL_DENSITY = 1.225 // kg/m^3
export const SEA_LEVEL_PRESSURE = 101_325 // Pa
export const SEA_LEVEL_TEMP = 288.15 // K

export const DEG2RAD = Math.PI / 180
export const RAD2DEG = 180 / Math.PI

/** Gravitational acceleration at a given altitude above sea level, from Newton's law of gravitation. */
export function gravityAt(altitude: number): number {
  const r = EARTH_RADIUS + Math.max(altitude, 0)
  return G0 * (EARTH_RADIUS / r) ** 2
}
