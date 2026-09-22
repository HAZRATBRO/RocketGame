import { atmosphereAt, gravityAt } from './atmosphere'

/**
 * A "world" physics profile: multipliers applied on top of the standard Earth gravity and
 * ISA atmosphere model, so a different terrain/world choice can change the physics a rocket
 * actually experiences, not just the scenery.
 */
export interface Environment {
  /** Multiplies Earth's altitude-adjusted gravity (1 = Earth, 0.166 = Moon, 0.379 = Mars). */
  gravityMultiplier: number
  /** Multiplies ISA air density at a given altitude (thicker/thinner atmosphere than Earth's). */
  airDensityMultiplier: number
  /** Shifts ISA temperature by a fixed offset (K) — a cheap stand-in for a hotter/colder world. */
  temperatureOffsetK: number
  /** True for worlds with no meaningful atmosphere (drag and dynamic pressure are always zero). */
  airless: boolean
}

export const EARTH_ENVIRONMENT: Environment = {
  gravityMultiplier: 1,
  airDensityMultiplier: 1,
  temperatureOffsetK: 0,
  airless: false,
}

/** Local gravitational acceleration (m/s^2) under a given world's physics. */
export function effectiveGravity(altitude: number, env: Environment): number {
  return gravityAt(altitude) * env.gravityMultiplier
}

export interface EffectiveAtmosphere {
  density: number
  speedOfSound: number
}

/** Air density and speed of sound at a given altitude, adjusted for the chosen world. */
export function effectiveAtmosphere(altitude: number, env: Environment): EffectiveAtmosphere {
  if (env.airless) return { density: 0, speedOfSound: atmosphereAt(altitude).speedOfSound }
  const atmo = atmosphereAt(altitude)
  const temperature = Math.max(atmo.temperature + env.temperatureOffsetK, 1)
  // Density scales inversely with temperature at fixed pressure (ideal gas law), plus the
  // world's own density multiplier for a fundamentally thicker/thinner atmosphere.
  const density = atmo.density * env.airDensityMultiplier * (atmo.temperature / temperature)
  const speedOfSound = atmo.speedOfSound * Math.sqrt(temperature / atmo.temperature)
  return { density, speedOfSound }
}
