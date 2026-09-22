import { dragCoefficient, dynamicPressure } from './aerodynamics'
import { atmosphereAt } from './atmosphere'
import { DEG2RAD, gravityAt } from './constants'
import {
  type RocketComponent,
  type RocketDesign,
  type StageGroup,
  baseDragCoefficient,
  buildStages,
  propellantRemaining,
  referenceArea,
  thrustAt,
} from './rocket'

export interface LaunchParams {
  /** Elevation angle from horizontal, degrees (90 = straight up). */
  elevationDeg: number
  /** Compass azimuth toward the target, degrees (0 = north, 90 = east). */
  azimuthDeg: number
  /** Launch site altitude above sea level, m. */
  launchSiteAltitude?: number
  /** Duration the rocket rides straight up on the launch rod/tower before pitching over, s. */
  verticalRodTime?: number
  /** Duration of the pitch-over ("gravity turn kick") from vertical to the target elevation, s. */
  pitchKickDuration?: number
  /** Integration timestep, s. Smaller = more accurate but slower. */
  dt?: number
  /** Safety cap on total simulated flight time, s. */
  maxTime?: number
}

export interface FlightSample {
  t: number
  xNorth: number
  xEast: number
  altitude: number
  speed: number
  mach: number
  dynamicPressure: number
  thrust: number
  mass: number
  accel: number // magnitude of net acceleration, m/s^2
  stageIndex: number
}

export interface FlightSummary {
  apogee: number
  apogeeTime: number
  maxVelocity: number
  maxMach: number
  maxDynamicPressure: number
  maxAccelG: number
  burnoutTime: number | null
  flightTime: number
  /** Horizontal distance from launch point to impact point, m. */
  range: number
  impactPoint: { xNorth: number; xEast: number }
  liftoff: boolean
}

export interface SimulationResult {
  samples: FlightSample[]
  summary: FlightSummary
}

interface Vec6 {
  xN: number
  xE: number
  alt: number
  vN: number
  vE: number
  vAlt: number
}

function pitchAngleRad(t: number, verticalRodTime: number, pitchKickDuration: number, elevationRad: number): number {
  const vertical = Math.PI / 2
  if (t <= verticalRodTime) return vertical
  if (t >= verticalRodTime + pitchKickDuration) return elevationRad
  const frac = (t - verticalRodTime) / pitchKickDuration
  return vertical + (elevationRad - vertical) * frac
}

/** Instantaneous total thrust (N) and total vehicle mass (kg) at simulated time `t`. */
function massAndThrust(stages: StageGroup[], stageIndex: number, localT: number) {
  const stage = stages[stageIndex]
  let thrust = 0
  let propNow = 0
  for (const engine of stage.engines) {
    thrust += thrustAt(engine, localT)
    propNow += propellantRemaining(engine, localT)
  }
  let mass = stage.dryMass + propNow
  for (let i = stageIndex + 1; i < stages.length; i++) {
    mass += stages[i].dryMass + stages[i].propellantMass
  }
  return { thrust, mass }
}

const DEFAULTS = {
  launchSiteAltitude: 0,
  dt: 0.02,
  maxTime: 600,
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Integrates the 6-state rocket trajectory (north/east/altitude position and velocity) with
 * classic 4th-order Runge-Kutta, under thrust (staged), gravity, and Mach-dependent
 * aerodynamic drag. The rocket's attitude follows a simple rigid pitch program: vertical
 * through the launch rod, a linear pitch-over ("gravity turn kick") to the commanded
 * elevation angle, then a fixed attitude for the remainder of powered flight — approximating
 * a finned, aerodynamically-stable vehicle. After the final stage burns out the vehicle
 * coasts ballistically (drag + gravity only) until it descends back through the launch
 * altitude.
 */
export function runSimulation(design: RocketDesign, params: LaunchParams): SimulationResult {
  const stages = buildStages(design.components)
  // The rod/kick pitch program should finish well before first-stage burnout so the rocket
  // spends a meaningful portion of its burn flying a fixed, commanded attitude — otherwise the
  // pitch-over is still in progress at burnout and range stops behaving as a function of the
  // commanded elevation the way a real staged/finned rocket's would. Scale both durations off
  // the first stage's burn time, with sane floors/ceilings for very short or very long motors.
  const firstBurnTime = stages[0]?.burnTime ?? 0
  const dynamicDefaults = {
    verticalRodTime: clamp(firstBurnTime * 0.15, 0.3, 1.2),
    pitchKickDuration: clamp(firstBurnTime * 0.45, 0.6, 4),
  }
  const opts = { ...DEFAULTS, ...dynamicDefaults, ...params }
  const emptyResult: SimulationResult = {
    samples: [],
    summary: {
      apogee: 0,
      apogeeTime: 0,
      maxVelocity: 0,
      maxMach: 0,
      maxDynamicPressure: 0,
      maxAccelG: 0,
      burnoutTime: null,
      flightTime: 0,
      range: 0,
      impactPoint: { xNorth: 0, xEast: 0 },
      liftoff: false,
    },
  }
  if (stages.length === 0 || stages.every((s) => s.engines.length === 0)) return emptyResult

  const elevationRad = opts.elevationDeg * DEG2RAD
  const azimuthRad = opts.azimuthDeg * DEG2RAD
  const dirN = Math.cos(azimuthRad)
  const dirE = Math.sin(azimuthRad)
  const area = referenceArea(design.components)
  const baseCd = baseDragCoefficient(design.components)
  const dt = opts.dt

  let state: Vec6 = { xN: 0, xE: 0, alt: opts.launchSiteAltitude, vN: 0, vE: 0, vAlt: 0 }
  let t = 0
  let stageIndex = 0
  let stageIgnitionT = 0
  let burnoutTime: number | null = null

  const samples: FlightSample[] = []
  let apogee = opts.launchSiteAltitude
  let apogeeTime = 0
  let maxVelocity = 0
  let maxMach = 0
  let maxDynamicPressure = 0
  let maxAccel = 0

  function derivative(s: Vec6, simT: number, sIdx: number, sIgnitionT: number) {
    const localT = simT - sIgnitionT
    const { thrust, mass } = massAndThrust(stages, sIdx, localT)
    const pitch = pitchAngleRad(simT, opts.verticalRodTime, opts.pitchKickDuration, elevationRad)
    const cosPitch = Math.cos(pitch)
    const thrustDirN = cosPitch * dirN
    const thrustDirE = cosPitch * dirE
    const thrustDirUp = Math.sin(pitch)

    const speed = Math.sqrt(s.vN * s.vN + s.vE * s.vE + s.vAlt * s.vAlt)
    const atmo = atmosphereAt(s.alt)
    const mach = atmo.speedOfSound > 0 ? speed / atmo.speedOfSound : 0
    const cd = dragCoefficient(mach, baseCd)
    const q = dynamicPressure(atmo.density, speed)
    const dragMag = q * cd * area
    const invSpeed = speed > 1e-6 ? 1 / speed : 0
    const dragDirN = -s.vN * invSpeed
    const dragDirE = -s.vE * invSpeed
    const dragDirUp = -s.vAlt * invSpeed

    const g = gravityAt(s.alt)

    const accN = (thrust * thrustDirN + dragMag * dragDirN) / mass
    const accE = (thrust * thrustDirE + dragMag * dragDirE) / mass
    const accUp = (thrust * thrustDirUp + dragMag * dragDirUp) / mass - g

    return {
      d: { xN: s.vN, xE: s.vE, alt: s.vAlt, vN: accN, vE: accE, vAlt: accUp } as Vec6,
      info: { thrust, mass, mach, q, accelMag: Math.sqrt(accN * accN + accE * accE + accUp * accUp) },
    }
  }

  function addScaled(a: Vec6, b: Vec6, h: number): Vec6 {
    return {
      xN: a.xN + b.xN * h,
      xE: a.xE + b.xE * h,
      alt: a.alt + b.alt * h,
      vN: a.vN + b.vN * h,
      vE: a.vE + b.vE * h,
      vAlt: a.vAlt + b.vAlt * h,
    }
  }

  const lastStageIndex = stages.length - 1
  let prevAltForLanding = state.alt
  let landed = false

  while (t < opts.maxTime && !landed) {
    // Advance to next stage if the current one (with engines) has burned out and isn't last.
    let localT = t - stageIgnitionT
    while (
      stageIndex < lastStageIndex &&
      (stages[stageIndex].engines.length === 0 ? true : localT >= stages[stageIndex].burnTime)
    ) {
      stageIndex += 1
      stageIgnitionT = t
      localT = t - stageIgnitionT
    }
    if (
      burnoutTime === null &&
      stageIndex === lastStageIndex &&
      stages[lastStageIndex].burnTime > 0 &&
      localT >= stages[lastStageIndex].burnTime
    ) {
      burnoutTime = t
    }

    const k1 = derivative(state, t, stageIndex, stageIgnitionT)
    const k2 = derivative(addScaled(state, k1.d, dt / 2), t + dt / 2, stageIndex, stageIgnitionT)
    const k3 = derivative(addScaled(state, k2.d, dt / 2), t + dt / 2, stageIndex, stageIgnitionT)
    const k4 = derivative(addScaled(state, k3.d, dt), t + dt, stageIndex, stageIgnitionT)

    const next: Vec6 = {
      xN: state.xN + (dt / 6) * (k1.d.xN + 2 * k2.d.xN + 2 * k3.d.xN + k4.d.xN),
      xE: state.xE + (dt / 6) * (k1.d.xE + 2 * k2.d.xE + 2 * k3.d.xE + k4.d.xE),
      alt: state.alt + (dt / 6) * (k1.d.alt + 2 * k2.d.alt + 2 * k3.d.alt + k4.d.alt),
      vN: state.vN + (dt / 6) * (k1.d.vN + 2 * k2.d.vN + 2 * k3.d.vN + k4.d.vN),
      vE: state.vE + (dt / 6) * (k1.d.vE + 2 * k2.d.vE + 2 * k3.d.vE + k4.d.vE),
      vAlt: state.vAlt + (dt / 6) * (k1.d.vAlt + 2 * k2.d.vAlt + 2 * k3.d.vAlt + k4.d.vAlt),
    }

    prevAltForLanding = state.alt
    const prevT = t
    const prevSample = state
    state = next
    t += dt

    const speed = Math.sqrt(state.vN * state.vN + state.vE * state.vE + state.vAlt * state.vAlt)
    samples.push({
      t,
      xNorth: state.xN,
      xEast: state.xE,
      altitude: state.alt,
      speed,
      mach: k1.info.mach,
      dynamicPressure: k1.info.q,
      thrust: k1.info.thrust,
      mass: k1.info.mass,
      accel: k1.info.accelMag,
      stageIndex,
    })

    if (state.alt > apogee) {
      apogee = state.alt
      apogeeTime = t
    }
    maxVelocity = Math.max(maxVelocity, speed)
    maxMach = Math.max(maxMach, k1.info.mach)
    maxDynamicPressure = Math.max(maxDynamicPressure, k1.info.q)
    maxAccel = Math.max(maxAccel, k1.info.accelMag)

    const pastAscent = t > opts.verticalRodTime + opts.pitchKickDuration
    if (pastAscent && state.vAlt < 0 && state.alt <= opts.launchSiteAltitude) {
      // Linear interpolation between the previous and current sample for a precise impact point.
      const frac = (opts.launchSiteAltitude - prevAltForLanding) / (state.alt - prevAltForLanding)
      const impactN = prevSample.xN + (state.xN - prevSample.xN) * frac
      const impactE = prevSample.xE + (state.xE - prevSample.xE) * frac
      const impactT = prevT + (t - prevT) * frac
      state = { ...state, xN: impactN, xE: impactE, alt: opts.launchSiteAltitude }
      t = impactT
      samples.push({
        t,
        xNorth: impactN,
        xEast: impactE,
        altitude: opts.launchSiteAltitude,
        speed,
        mach: k1.info.mach,
        dynamicPressure: k1.info.q,
        thrust: 0,
        mass: k1.info.mass,
        accel: k1.info.accelMag,
        stageIndex,
      })
      landed = true
    }
  }

  const finalSample = samples[samples.length - 1]
  const range = finalSample ? Math.sqrt(finalSample.xNorth ** 2 + finalSample.xEast ** 2) : 0

  return {
    samples,
    summary: {
      apogee,
      apogeeTime,
      maxVelocity,
      maxMach,
      maxDynamicPressure,
      maxAccelG: maxAccel / 9.80665,
      burnoutTime,
      flightTime: t,
      range,
      impactPoint: finalSample ? { xNorth: finalSample.xNorth, xEast: finalSample.xEast } : { xNorth: 0, xEast: 0 },
      liftoff: true,
    },
  }
}

/** Downsamples a flight sample series to at most `maxPoints` for cheap charting/animation. */
export function downsample(samples: FlightSample[], maxPoints: number): FlightSample[] {
  if (samples.length <= maxPoints) return samples
  const step = samples.length / maxPoints
  const out: FlightSample[] = []
  for (let i = 0; i < maxPoints; i++) {
    out.push(samples[Math.floor(i * step)])
  }
  out.push(samples[samples.length - 1])
  return out
}

export type { RocketComponent }
