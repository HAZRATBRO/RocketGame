import { RAD2DEG } from './constants'
import type { Environment } from './environment'
import type { RocketDesign } from './rocket'
import { type SimulationResult, runSimulation } from './simulate'
import type { TerrainSampler } from './terrain'

export interface WorldContext {
  environment?: Environment
  terrain?: TerrainSampler
}

export interface TargetingResult {
  hit: boolean
  elevationDeg: number
  azimuthDeg: number
  distance: number
  achievedRange: number
  missDistance: number
  maxRange: number
  simulation: SimulationResult | null
  reason?: string
}

/** Bearing (compass degrees, 0=N/90=E) and horizontal distance (m) from launch to target. */
export function bearingAndDistance(launch: { x: number; y: number }, target: { x: number; y: number }) {
  const dN = target.y - launch.y // screen "up" treated as north
  const dE = target.x - launch.x
  const distance = Math.sqrt(dN * dN + dE * dE)
  const azimuthDeg = (Math.atan2(dE, dN) * RAD2DEG + 360) % 360
  return { azimuthDeg, distance }
}

/**
 * Solves for the launch elevation angle that lands the rocket at the requested horizontal
 * range, using a classic artillery "shooting method": a coarse scan over elevation finds a
 * bracket where the achieved range crosses the target range, then bisection refines the
 * elevation within that bracket. Since range-vs-elevation typically rises then falls (like
 * the ideal projectile range curve, distorted by drag), this returns the lower-angle
 * ("flatter", faster, ascending-branch) solution when one exists.
 */
export function solveForTarget(
  design: RocketDesign,
  distance: number,
  azimuthDeg: number,
  world: WorldContext = {},
): TargetingResult {
  const coarseDt = 0.08
  const fineDt = 0.02

  const rangeAt = (elevationDeg: number, dt: number): SimulationResult =>
    runSimulation(design, { elevationDeg, azimuthDeg, dt, environment: world.environment, terrain: world.terrain })

  // Non-uniform scan: fine resolution at very low (flat/fast) angles where an overpowered
  // rocket's range can already be large due to the launch-rod/pitch-kick climb, then coarser
  // through the rest of the curve. Every point is an actual simulation run — no analytic
  // shortcuts, since the forced vertical rod phase means range does not simply vanish at
  // low commanded elevation angles the way an idealized instantaneous launch would.
  const scanAngles: number[] = [0.5, 1, 2, 3, 4]
  for (let deg = 5; deg <= 85; deg += 2.5) scanAngles.push(deg)

  const angles: number[] = []
  const ranges: number[] = []
  let maxRange = 0
  let bestAngleAtMax = 45
  let minRange = Number.POSITIVE_INFINITY
  let angleAtMinRange = 85
  for (const deg of scanAngles) {
    const result = rangeAt(deg, coarseDt)
    angles.push(deg)
    ranges.push(result.summary.range)
    if (result.summary.range > maxRange) {
      maxRange = result.summary.range
      bestAngleAtMax = deg
    }
    if (result.summary.range < minRange) {
      minRange = result.summary.range
      angleAtMinRange = deg
    }
  }

  if (maxRange < distance) {
    return {
      hit: false,
      elevationDeg: bestAngleAtMax,
      azimuthDeg,
      distance,
      achievedRange: maxRange,
      missDistance: distance - maxRange,
      maxRange,
      simulation: null,
      reason: `Target is out of range. Maximum range for this rocket is about ${Math.round(maxRange)} m at a ${bestAngleAtMax}° elevation.`,
    }
  }

  let lowDeg = angles[0]
  let highDeg = angles[angles.length - 1]
  let bracketed = false
  for (let i = 0; i < angles.length - 1; i++) {
    const r0 = ranges[i] - distance
    const r1 = ranges[i + 1] - distance
    if (r0 === 0) {
      lowDeg = angles[i]
      highDeg = angles[i]
      bracketed = true
      break
    }
    // Any sign change (rising OR falling) is a valid root bracket: with the launch-rod/kick
    // pitch program, range-vs-elevation is not guaranteed to rise-then-fall like an idealized
    // projectile curve — an overpowered rocket can have its longest range at a very low
    // commanded angle and simply fall off monotonically from there.
    if (r0 * r1 < 0) {
      lowDeg = angles[i]
      highDeg = angles[i + 1]
      bracketed = true
      break
    }
  }

  if (!bracketed) {
    const tooClose = distance < minRange
    return {
      hit: false,
      elevationDeg: tooClose ? angleAtMinRange : bestAngleAtMax,
      azimuthDeg,
      distance,
      achievedRange: tooClose ? minRange : maxRange,
      missDistance: tooClose ? minRange - distance : distance - maxRange,
      maxRange,
      simulation: null,
      reason: tooClose
        ? `Target is too close. Even this rocket's shortest tested trajectory (${angleAtMinRange}° elevation) overshoots it, landing around ${Math.round(minRange)} m out.`
        : 'Could not find a firing solution for this target at this rocket’s achievable range curve.',
    }
  }

  let lo = lowDeg
  let hi = highDeg
  let loRange = rangeAt(lo, coarseDt).summary.range
  for (let i = 0; i < 22 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2
    const midRange = rangeAt(mid, coarseDt).summary.range
    if ((loRange - distance) * (midRange - distance) <= 0) {
      hi = mid
    } else {
      lo = mid
      loRange = midRange
    }
  }

  const elevationDeg = (lo + hi) / 2
  const finalSim = rangeAt(elevationDeg, fineDt)
  const achievedRange = finalSim.summary.range
  const missDistance = Math.abs(achievedRange - distance)

  return {
    hit: missDistance < Math.max(5, distance * 0.01),
    elevationDeg,
    azimuthDeg,
    distance,
    achievedRange,
    missDistance,
    maxRange,
    simulation: finalSim,
  }
}
