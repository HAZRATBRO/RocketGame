import { G0 } from './constants'

export type ComponentType = 'nose-cone' | 'body-tube' | 'engine' | 'fins' | 'payload' | 'recovery'

export type NoseConeShape = 'conical' | 'ogive' | 'elliptical'
export type ThrustCurveShape = 'constant' | 'progressive' | 'regressive'

interface BaseComponent {
  id: string
  type: ComponentType
  name: string
  /** Separation stage this component belongs to. Components sharing a stage number are
   *  jettisoned together once that stage's engines (if any) burn out. */
  stage: number
  /** Dry/structural mass in kg. For engines this is the casing mass, excluding propellant. */
  mass: number
}

export interface NoseConeComponent extends BaseComponent {
  type: 'nose-cone'
  shape: NoseConeShape
  length: number // m
  diameter: number // m
  /** Base (subsonic) drag-coefficient contribution of the nose shape. */
  dragCoefficient: number
}

export interface BodyTubeComponent extends BaseComponent {
  type: 'body-tube'
  length: number // m
  diameter: number // m
}

export interface FinsComponent extends BaseComponent {
  type: 'fins'
  count: number
  span: number // m, root to tip
  rootChord: number // m
  tipChord: number // m
}

export interface PayloadComponent extends BaseComponent {
  type: 'payload'
}

export interface RecoveryComponent extends BaseComponent {
  type: 'recovery'
}

export interface EngineComponent extends BaseComponent {
  type: 'engine'
  propellantMass: number // kg
  burnTime: number // s
  avgThrust: number // N
  thrustCurveShape: ThrustCurveShape
}

export type RocketComponent =
  | NoseConeComponent
  | BodyTubeComponent
  | FinsComponent
  | PayloadComponent
  | RecoveryComponent
  | EngineComponent

export interface RocketDesign {
  id: string
  name: string
  components: RocketComponent[]
}

/** Distributes `Omit` across the RocketComponent union so each variant keeps its own shape. */
export type NewRocketComponent<T extends RocketComponent = RocketComponent> = T extends RocketComponent
  ? Omit<T, 'id'>
  : never

export function isEngine(c: RocketComponent): c is EngineComponent {
  return c.type === 'engine'
}

/** Total impulse of an engine (N*s) = average thrust * burn time. */
export function totalImpulse(engine: EngineComponent): number {
  return engine.avgThrust * engine.burnTime
}

/** Specific impulse (s), derived from total impulse and propellant mass: Isp = J / (m_p * g0). */
export function specificImpulse(engine: EngineComponent): number {
  if (engine.propellantMass <= 0) return 0
  return totalImpulse(engine) / (engine.propellantMass * G0)
}

/**
 * Instantaneous thrust (N) at time `t` since ignition, for the engine's chosen curve shape.
 * All shapes share the same total impulse (average thrust * burn time); only the profile
 * across the burn differs:
 *  - constant: flat thrust for the whole burn
 *  - progressive: ramps up from 0.5x average to 1.5x average (typical of some solid grains)
 *  - regressive: ramps down from 1.5x average to 0.5x average
 */
export function thrustAt(engine: EngineComponent, t: number): number {
  if (t < 0 || t > engine.burnTime || engine.burnTime <= 0) return 0
  const frac = t / engine.burnTime
  switch (engine.thrustCurveShape) {
    case 'constant':
      return engine.avgThrust
    case 'progressive':
      return engine.avgThrust * (0.5 + frac)
    case 'regressive':
      return engine.avgThrust * (1.5 - frac)
  }
}

/**
 * Cumulative impulse delivered from ignition through time `t` (N*s), used to derive the
 * exact propellant-burned fraction without needing mass flow as a separate integrated state.
 */
export function impulseThrough(engine: EngineComponent, t: number): number {
  const clampedT = Math.max(0, Math.min(t, engine.burnTime))
  if (engine.burnTime <= 0) return 0
  let a: number
  let b: number
  switch (engine.thrustCurveShape) {
    case 'constant':
      a = engine.avgThrust
      b = engine.avgThrust
      break
    case 'progressive':
      a = engine.avgThrust * 0.5
      b = engine.avgThrust * 1.5
      break
    case 'regressive':
      a = engine.avgThrust * 1.5
      b = engine.avgThrust * 0.5
      break
  }
  // Linear thrust a -> b over the burn; impulse to time clampedT is the trapezoid area
  // scaled to the local slope, integral_0^t (a + (b-a)*x/burnTime) dx.
  return a * clampedT + ((b - a) * clampedT * clampedT) / (2 * engine.burnTime)
}

/** Remaining propellant mass (kg) at time `t` since ignition. */
export function propellantRemaining(engine: EngineComponent, t: number): number {
  if (engine.propellantMass <= 0) return 0
  const impulse = totalImpulse(engine)
  if (impulse <= 0) return engine.propellantMass
  const burnedFraction = impulseThrough(engine, t) / impulse
  return engine.propellantMass * (1 - Math.min(1, Math.max(0, burnedFraction)))
}

export interface StageGroup {
  stageNumber: number
  components: RocketComponent[]
  engines: EngineComponent[]
  /** Structural (dry) mass of every component in this stage, including engine casings. */
  dryMass: number
  /** Total propellant mass carried by this stage's engines. */
  propellantMass: number
  /** Burn duration of this stage = longest engine burn time in the group (0 if no engines). */
  burnTime: number
  totalImpulse: number
}

/** Groups a rocket's components into ascending, ordered stages by their `stage` field. */
export function buildStages(components: RocketComponent[]): StageGroup[] {
  const byStage = new Map<number, RocketComponent[]>()
  for (const c of components) {
    const list = byStage.get(c.stage) ?? []
    list.push(c)
    byStage.set(c.stage, list)
  }
  const stageNumbers = [...byStage.keys()].sort((a, b) => a - b)
  return stageNumbers.map((stageNumber) => {
    const comps = byStage.get(stageNumber)!
    const engines = comps.filter(isEngine)
    const dryMass = comps.reduce((sum, c) => sum + c.mass, 0)
    const propellantMass = engines.reduce((sum, e) => sum + e.propellantMass, 0)
    const burnTime = engines.reduce((max, e) => Math.max(max, e.burnTime), 0)
    const impulse = engines.reduce((sum, e) => sum + totalImpulse(e), 0)
    return { stageNumber, components: comps, engines, dryMass, propellantMass, burnTime, totalImpulse: impulse }
  })
}

/** Largest airframe diameter (m) among nose cone / body tube components — used for cross-sectional area. */
export function rocketDiameter(components: RocketComponent[]): number {
  let d = 0
  for (const c of components) {
    if (c.type === 'nose-cone' || c.type === 'body-tube') d = Math.max(d, c.diameter)
  }
  return d
}

/** Reference cross-sectional area (m^2) = pi * r^2 from the max airframe diameter. */
export function referenceArea(components: RocketComponent[]): number {
  const d = rocketDiameter(components)
  return Math.PI * (d / 2) ** 2
}

/**
 * Base (subsonic) drag coefficient for the whole rocket: nose-cone contribution plus a
 * small fixed increment per fin set for induced/interference drag, and a base skin-friction
 * allowance. This is a simplified aggregate model, not a full panel-method computation.
 */
export function baseDragCoefficient(components: RocketComponent[]): number {
  let cd = 0.35 // skin friction / base drag allowance for a typical slender airframe
  for (const c of components) {
    if (c.type === 'nose-cone') cd += c.dragCoefficient
    if (c.type === 'fins') cd += 0.02 * c.count
  }
  return Math.max(cd, 0.1)
}

export function liftoffMass(design: RocketDesign): number {
  return design.components.reduce((sum, c) => sum + c.mass + (isEngine(c) ? c.propellantMass : 0), 0)
}

export function dryMassTotal(design: RocketDesign): number {
  return design.components.reduce((sum, c) => sum + c.mass, 0)
}

export function propellantMassTotal(design: RocketDesign): number {
  return design.components.reduce((sum, c) => sum + (isEngine(c) ? c.propellantMass : 0), 0)
}

export function totalImpulseOf(design: RocketDesign): number {
  return design.components.filter(isEngine).reduce((sum, e) => sum + totalImpulse(e), 0)
}

export function liftoffThrust(design: RocketDesign): number {
  const stages = buildStages(design.components)
  if (stages.length === 0) return 0
  return stages[0].engines.reduce((sum, e) => sum + thrustAt(e, 0), 0)
}

/** Thrust-to-weight ratio at liftoff (dimensionless). Must exceed 1 to leave the pad. */
export function liftoffTWR(design: RocketDesign): number {
  const mass = liftoffMass(design)
  if (mass <= 0) return 0
  return liftoffThrust(design) / (mass * G0)
}

let idCounter = 0
export function newComponentId(): string {
  idCounter += 1
  return `c${Date.now().toString(36)}${idCounter}`
}
