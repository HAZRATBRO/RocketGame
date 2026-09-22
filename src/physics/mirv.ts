import { dragCoefficient, dynamicPressure } from './aerodynamics'
import { DEG2RAD } from './constants'
import { EARTH_ENVIRONMENT, type Environment, effectiveAtmosphere, effectiveGravity } from './environment'
import type { RocketDesign } from './rocket'
import { type FlightSample, runSimulation } from './simulate'
import { bearingAndDistance, solveForTarget } from './targeting'
import type { TerrainSampler } from './terrain'

export const MAX_MIRV_WARHEADS = 4

/** Small, streamlined reentry-vehicle aerodynamics — not the full rocket's airframe. */
const WARHEAD_REFERENCE_AREA = 0.035 // m^2
const WARHEAD_BASE_CD = 0.22
const DEFAULT_WARHEAD_MASS = 25 // kg, used if the design carries no payload component

export interface MirvTarget {
  id: string
  xEast: number
  xNorth: number
}

export interface WarheadResult {
  targetId: string
  hit: boolean
  elevationDeg: number
  azimuthDeg: number
  distanceFromRelease: number
  achievedDistanceFromRelease: number
  missDistance: number
  /** This warhead's own post-release coast trail only (the shared boost is `MirvPlan.boostSamples`). */
  samples: FlightSample[]
  impactPoint: { xNorth: number; xEast: number }
  reason?: string
}

export interface MirvPlan {
  hit: boolean
  boostSamples: FlightSample[]
  releaseTime: number
  releaseAltitude: number
  warheadMass: number
  warheads: WarheadResult[]
  reason?: string
}

interface BallisticState {
  xN: number
  xE: number
  alt: number
  vN: number
  vE: number
  vAlt: number
}

function simulateBallistic(
  initial: BallisticState,
  startTime: number,
  mass: number,
  environment: Environment,
  terrain: TerrainSampler,
  dt = 0.02,
  maxTime = 400,
): FlightSample[] {
  let state = { ...initial }
  let t = startTime
  const samples: FlightSample[] = []

  function derivative(s: BallisticState) {
    const speed = Math.hypot(s.vN, s.vE, s.vAlt)
    const atmo = effectiveAtmosphere(s.alt, environment)
    const mach = atmo.speedOfSound > 0 ? speed / atmo.speedOfSound : 0
    const cd = dragCoefficient(mach, WARHEAD_BASE_CD)
    const q = dynamicPressure(atmo.density, speed)
    const dragMag = q * cd * WARHEAD_REFERENCE_AREA
    const invSpeed = speed > 1e-6 ? 1 / speed : 0
    const g = effectiveGravity(s.alt, environment)
    const accN = (dragMag * (-s.vN * invSpeed)) / mass
    const accE = (dragMag * (-s.vE * invSpeed)) / mass
    const accUp = (dragMag * (-s.vAlt * invSpeed)) / mass - g
    return {
      d: { xN: s.vN, xE: s.vE, alt: s.vAlt, vN: accN, vE: accE, vAlt: accUp } as BallisticState,
      info: { mach, q, accelMag: Math.hypot(accN, accE, accUp) },
    }
  }

  const addScaled = (a: BallisticState, b: BallisticState, h: number): BallisticState => ({
    xN: a.xN + b.xN * h,
    xE: a.xE + b.xE * h,
    alt: a.alt + b.alt * h,
    vN: a.vN + b.vN * h,
    vE: a.vE + b.vE * h,
    vAlt: a.vAlt + b.vAlt * h,
  })

  let landed = false
  while (t - startTime < maxTime && !landed) {
    const k1 = derivative(state)
    const k2 = derivative(addScaled(state, k1.d, dt / 2))
    const k3 = derivative(addScaled(state, k2.d, dt / 2))
    const k4 = derivative(addScaled(state, k3.d, dt))
    const next: BallisticState = {
      xN: state.xN + (dt / 6) * (k1.d.xN + 2 * k2.d.xN + 2 * k3.d.xN + k4.d.xN),
      xE: state.xE + (dt / 6) * (k1.d.xE + 2 * k2.d.xE + 2 * k3.d.xE + k4.d.xE),
      alt: state.alt + (dt / 6) * (k1.d.alt + 2 * k2.d.alt + 2 * k3.d.alt + k4.d.alt),
      vN: state.vN + (dt / 6) * (k1.d.vN + 2 * k2.d.vN + 2 * k3.d.vN + k4.d.vN),
      vE: state.vE + (dt / 6) * (k1.d.vE + 2 * k2.d.vE + 2 * k3.d.vE + k4.d.vE),
      vAlt: state.vAlt + (dt / 6) * (k1.d.vAlt + 2 * k2.d.vAlt + 2 * k3.d.vAlt + k4.d.vAlt),
    }
    const prev = state
    const prevGround = terrain(prev.xE, prev.xN)
    state = next
    t += dt
    const ground = terrain(state.xE, state.xN)
    const speed = Math.hypot(state.vN, state.vE, state.vAlt)

    if (state.alt <= ground) {
      const denom = state.alt - prev.alt
      const frac = denom !== 0 ? Math.min(1, Math.max(0, (ground - prev.alt) / denom)) : 1
      const impactN = prev.xN + (state.xN - prev.xN) * frac
      const impactE = prev.xE + (state.xE - prev.xE) * frac
      const impactAlt = prevGround + (ground - prevGround) * frac
      const impactT = t - dt + dt * frac
      state = { ...state, xN: impactN, xE: impactE, alt: impactAlt }
      t = impactT
      samples.push({
        t,
        xNorth: impactN,
        xEast: impactE,
        altitude: impactAlt,
        terrainHeight: impactAlt,
        vNorth: state.vN,
        vEast: state.vE,
        vAlt: state.vAlt,
        speed,
        mach: k1.info.mach,
        dynamicPressure: k1.info.q,
        thrust: 0,
        mass,
        accel: k1.info.accelMag,
        stageIndex: -1,
      })
      landed = true
      break
    }

    samples.push({
      t,
      xNorth: state.xN,
      xEast: state.xE,
      altitude: state.alt,
      terrainHeight: ground,
      vNorth: state.vN,
      vEast: state.vE,
      vAlt: state.vAlt,
      speed,
      mach: k1.info.mach,
      dynamicPressure: k1.info.q,
      thrust: 0,
      mass,
      accel: k1.info.accelMag,
      stageIndex: -1,
    })
  }

  return samples
}

/** Solves for the coast elevation angle (from the release point, at fixed speed & azimuth) that lands a warhead exactly `distanceFromRelease` away, via the same coarse-scan-then-bisection shooting method used for the primary launch solver. */
function solveWarheadElevation(
  release: BallisticState,
  releaseTime: number,
  mass: number,
  environment: Environment,
  terrain: TerrainSampler,
  azimuthDeg: number,
  speed: number,
  distanceFromRelease: number,
): { elevationDeg: number; achieved: number; samples: FlightSample[]; hit: boolean; reason?: string } {
  const azRad = azimuthDeg * DEG2RAD
  const dirN = Math.cos(azRad)
  const dirE = Math.sin(azRad)

  const runAt = (elevationDeg: number, dt: number) => {
    const elRad = elevationDeg * DEG2RAD
    const cosEl = Math.cos(elRad)
    const initial: BallisticState = {
      xN: release.xN,
      xE: release.xE,
      alt: release.alt,
      vN: speed * cosEl * dirN,
      vE: speed * cosEl * dirE,
      vAlt: speed * Math.sin(elRad),
    }
    const samples = simulateBallistic(initial, releaseTime, mass, environment, terrain, dt)
    const last = samples[samples.length - 1]
    const dist = last ? Math.hypot(last.xNorth - release.xN, last.xEast - release.xE) : 0
    return { dist, samples }
  }

  const angles: number[] = []
  const dists: number[] = []
  let maxDist = 0
  let bestAngle = 30
  let minDist = Number.POSITIVE_INFINITY
  let angleAtMin = 85
  for (let deg = -80; deg <= 85; deg += 5) {
    const { dist } = runAt(deg, 0.08)
    angles.push(deg)
    dists.push(dist)
    if (dist > maxDist) {
      maxDist = dist
      bestAngle = deg
    }
    if (dist < minDist) {
      minDist = dist
      angleAtMin = deg
    }
  }

  if (maxDist < distanceFromRelease) {
    const { samples } = runAt(bestAngle, 0.02)
    return {
      elevationDeg: bestAngle,
      achieved: maxDist,
      samples,
      hit: false,
      reason: `Out of the bus's post-boost range (max ~${Math.round(maxDist)} m from release).`,
    }
  }

  let lowDeg = angles[0]
  let highDeg = angles[angles.length - 1]
  let bracketed = false
  for (let i = 0; i < angles.length - 1; i++) {
    const r0 = dists[i] - distanceFromRelease
    const r1 = dists[i + 1] - distanceFromRelease
    if (r0 === 0) {
      lowDeg = angles[i]
      highDeg = angles[i]
      bracketed = true
      break
    }
    if (r0 * r1 < 0) {
      lowDeg = angles[i]
      highDeg = angles[i + 1]
      bracketed = true
      break
    }
  }

  if (!bracketed) {
    const tooClose = distanceFromRelease < minDist
    const { samples } = runAt(tooClose ? angleAtMin : bestAngle, 0.02)
    return {
      elevationDeg: tooClose ? angleAtMin : bestAngle,
      achieved: tooClose ? minDist : maxDist,
      samples,
      hit: false,
      reason: tooClose ? 'Target is too close to the release point for this warhead to hit.' : 'No steering solution found for this warhead.',
    }
  }

  let lo = lowDeg
  let hi = highDeg
  let loDist = runAt(lo, 0.08).dist
  for (let i = 0; i < 20 && hi - lo > 0.02; i++) {
    const mid = (lo + hi) / 2
    const midDist = runAt(mid, 0.08).dist
    if ((loDist - distanceFromRelease) * (midDist - distanceFromRelease) <= 0) {
      hi = mid
    } else {
      lo = mid
      loDist = midDist
    }
  }

  const elevationDeg = (lo + hi) / 2
  const final = runAt(elevationDeg, 0.02)
  const missDistance = Math.abs(final.dist - distanceFromRelease)
  return {
    elevationDeg,
    achieved: final.dist,
    samples: final.samples,
    hit: missDistance < Math.max(5, distanceFromRelease * 0.015),
  }
}

/**
 * Plans a MIRV strike: a single shared boost aimed at the target cluster's centroid, separating
 * into independent warheads right at booster burnout (the "post-boost vehicle" separation point
 * of a real MIRV, chosen instead of apogee so each warhead retains meaningful kinetic energy to
 * steer with). Each warhead then solves its own coast-phase shooting problem — fixed release
 * speed, azimuth aimed exactly at its assigned target from the release point, elevation angle
 * bisected to match the required range — reusing the same numerical method as the single-target
 * solver, just re-based at the separation point instead of the launch pad.
 */
export function planMirvStrike(
  design: RocketDesign,
  targets: MirvTarget[],
  environment: Environment = EARTH_ENVIRONMENT,
  terrain?: TerrainSampler,
): MirvPlan {
  const activeTargets = targets.slice(0, MAX_MIRV_WARHEADS)
  const flatTerrain: TerrainSampler = terrain ?? (() => 0)

  if (activeTargets.length === 0) {
    return { hit: false, boostSamples: [], releaseTime: 0, releaseAltitude: 0, warheadMass: 0, warheads: [], reason: 'No targets selected.' }
  }

  const centroid = activeTargets.reduce(
    (acc, t) => ({ x: acc.x + t.xEast / activeTargets.length, y: acc.y + t.xNorth / activeTargets.length }),
    { x: 0, y: 0 },
  )
  const { azimuthDeg: boostAzimuth, distance: centroidDistance } = bearingAndDistance({ x: 0, y: 0 }, centroid)
  // Reuse the single-target shooting-method solver to get a real, physics-grounded elevation
  // toward the cluster's centroid — but cap it at a moderate angle. A MIRV boost's job isn't to
  // land precisely on the centroid (each warhead re-aims independently after separation anyway);
  // it's to reach release with plenty of *residual horizontal speed* to steer with. An
  // uncapped solve can pick a very steep angle for a nearby cluster, which burns almost all of
  // that speed climbing rather than covering ground, leaving warheads with little maneuvering
  // budget — capping the angle keeps the boost comparatively flat and fast at burnout.
  const centroidSolve = solveForTarget(design, Math.max(centroidDistance, 50), boostAzimuth, { environment, terrain })
  const boostElevation = Math.min(centroidSolve.elevationDeg, 35)

  const boost = runSimulation(design, { elevationDeg: boostElevation, azimuthDeg: boostAzimuth, dt: 0.02, environment, terrain })
  if (!boost.summary.liftoff || boost.samples.length === 0) {
    return { hit: false, boostSamples: [], releaseTime: 0, releaseAltitude: 0, warheadMass: 0, warheads: [], reason: 'Rocket cannot fly — check the design.' }
  }

  const releaseTargetTime = boost.summary.burnoutTime ?? boost.summary.apogeeTime
  let releaseIndex = 0
  let bestDt = Number.POSITIVE_INFINITY
  for (let i = 0; i < boost.samples.length; i++) {
    const dt = Math.abs(boost.samples[i].t - releaseTargetTime)
    if (dt < bestDt) {
      bestDt = dt
      releaseIndex = i
    }
  }
  const releaseSample = boost.samples[releaseIndex]
  const boostSamples = boost.samples.slice(0, releaseIndex + 1)
  const release: BallisticState = {
    xN: releaseSample.xNorth,
    xE: releaseSample.xEast,
    alt: releaseSample.altitude,
    vN: releaseSample.vNorth,
    vE: releaseSample.vEast,
    vAlt: releaseSample.vAlt,
  }
  const releaseSpeed = Math.hypot(release.vN, release.vE, release.vAlt)
  const warheadMass = Math.max(payloadMassOf(design) / activeTargets.length, 1)

  const warheads: WarheadResult[] = activeTargets.map((target) => {
    const { azimuthDeg, distance } = bearingAndDistance({ x: release.xE, y: release.xN }, { x: target.xEast, y: target.xNorth })
    const solved = solveWarheadElevation(release, releaseSample.t, warheadMass, environment, flatTerrain, azimuthDeg, releaseSpeed, distance)
    const last = solved.samples[solved.samples.length - 1]
    return {
      targetId: target.id,
      hit: solved.hit,
      elevationDeg: solved.elevationDeg,
      azimuthDeg,
      distanceFromRelease: distance,
      achievedDistanceFromRelease: solved.achieved,
      missDistance: Math.abs(solved.achieved - distance),
      // Post-release samples only — the shared boost trail (`boostSamples` above) is common
      // to every warhead and is rendered once rather than duplicated per warhead.
      samples: solved.samples,
      impactPoint: last ? { xNorth: last.xNorth, xEast: last.xEast } : { xNorth: release.xN, xEast: release.xE },
      reason: solved.reason,
    }
  })

  return {
    hit: warheads.every((w) => w.hit),
    boostSamples,
    releaseTime: releaseSample.t,
    releaseAltitude: releaseSample.altitude,
    warheadMass,
    warheads,
  }
}

function payloadMassOf(design: RocketDesign): number {
  const payloadMass = design.components.filter((c) => c.type === 'payload').reduce((sum, c) => sum + c.mass, 0)
  return payloadMass > 0 ? payloadMass : DEFAULT_WARHEAD_MASS * 1
}
