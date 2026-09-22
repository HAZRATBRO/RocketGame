import { GAMMA_AIR, R_AIR, SEA_LEVEL_PRESSURE, SEA_LEVEL_TEMP, gravityAt } from './constants'

/**
 * International Standard Atmosphere (ISA) layer table.
 * Each layer gives the base altitude (m), base temperature (K), and lapse rate (K/m).
 * A lapse rate of 0 marks an isothermal layer.
 */
interface AtmosphereLayer {
  baseAltitude: number
  baseTemperature: number
  lapseRate: number
  basePressure: number // computed below
}

const RAW_LAYERS: Omit<AtmosphereLayer, 'basePressure'>[] = [
  { baseAltitude: 0, baseTemperature: 288.15, lapseRate: -0.0065 }, // troposphere
  { baseAltitude: 11_000, baseTemperature: 216.65, lapseRate: 0 }, // tropopause
  { baseAltitude: 20_000, baseTemperature: 216.65, lapseRate: 0.001 }, // stratosphere I
  { baseAltitude: 32_000, baseTemperature: 228.65, lapseRate: 0.0028 }, // stratosphere II
  { baseAltitude: 47_000, baseTemperature: 270.65, lapseRate: 0 }, // stratopause
  { baseAltitude: 51_000, baseTemperature: 270.65, lapseRate: -0.0028 }, // mesosphere I
  { baseAltitude: 71_000, baseTemperature: 214.65, lapseRate: -0.002 }, // mesosphere II
  { baseAltitude: 84_852, baseTemperature: 186.946, lapseRate: 0 }, // mesopause (upper bound of model)
]

// Standard sea-level gravity used to derive the ISA pressure table (fixed, not altitude-varying,
// matching the definition of the standard atmosphere itself).
const G_ISA = 9.80665

function buildLayers(): AtmosphereLayer[] {
  const layers: AtmosphereLayer[] = []
  let pressure = SEA_LEVEL_PRESSURE
  for (let i = 0; i < RAW_LAYERS.length; i++) {
    const raw = RAW_LAYERS[i]
    layers.push({ ...raw, basePressure: pressure })
    const next = RAW_LAYERS[i + 1]
    if (!next) break
    const height = next.baseAltitude - raw.baseAltitude
    if (raw.lapseRate === 0) {
      pressure = pressure * Math.exp((-G_ISA * height) / (R_AIR * raw.baseTemperature))
    } else {
      const topTemp = raw.baseTemperature + raw.lapseRate * height
      pressure = pressure * (topTemp / raw.baseTemperature) ** (-G_ISA / (R_AIR * raw.lapseRate))
    }
  }
  return layers
}

const LAYERS = buildLayers()
const TOP_ALTITUDE = RAW_LAYERS[RAW_LAYERS.length - 1].baseAltitude

export interface AtmosphericState {
  altitude: number
  temperature: number // K
  pressure: number // Pa
  density: number // kg/m^3
  speedOfSound: number // m/s
}

/**
 * Returns temperature, pressure, density, and speed of sound at a given altitude (m, MSL)
 * using the layered ISA model. Above the model's top (~85 km) the atmosphere is treated as
 * a near-vacuum with negligible density, which is an adequate approximation for anything but
 * true orbital mechanics.
 */
export function atmosphereAt(altitude: number): AtmosphericState {
  const h = Math.max(altitude, 0)

  if (h > TOP_ALTITUDE) {
    const top = LAYERS[LAYERS.length - 1]
    return {
      altitude: h,
      temperature: top.baseTemperature,
      pressure: 0,
      density: 0,
      speedOfSound: Math.sqrt(GAMMA_AIR * R_AIR * top.baseTemperature),
    }
  }

  let layer = LAYERS[0]
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    if (h >= LAYERS[i].baseAltitude) {
      layer = LAYERS[i]
      break
    }
  }

  const dh = h - layer.baseAltitude
  const temperature = layer.baseTemperature + layer.lapseRate * dh
  let pressure: number
  if (layer.lapseRate === 0) {
    pressure = layer.basePressure * Math.exp((-G_ISA * dh) / (R_AIR * layer.baseTemperature))
  } else {
    pressure = layer.basePressure * (temperature / layer.baseTemperature) ** (-G_ISA / (R_AIR * layer.lapseRate))
  }
  const density = pressure / (R_AIR * temperature)
  const speedOfSound = Math.sqrt(GAMMA_AIR * R_AIR * temperature)

  return { altitude: h, temperature, pressure, density, speedOfSound }
}

export { gravityAt }
export const SEA_LEVEL_REFERENCE = { temperature: SEA_LEVEL_TEMP, pressure: SEA_LEVEL_PRESSURE }
