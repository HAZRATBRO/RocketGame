import { DEG2RAD } from './constants'

export type TerrainStyle = 'flat' | 'rolling' | 'cliff'

export interface TerrainParams {
  seed: number
  style: TerrainStyle
  /** Elevation at the launch pad (0,0), m above sea level. */
  baseAltitude: number
  /** Roughly the max deviation from baseAltitude the terrain will reach, m. */
  reliefAmplitude: number
  /** Characteristic wavelength of the largest terrain features, m. */
  featureScale: number
}

export type TerrainSampler = (xEast: number, xNorth: number) => number

/** Small, fast, deterministic PRNG (mulberry32) so a terrain seed reproduces exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Octave {
  dirX: number
  dirY: number
  freq: number
  phase: number
  amp: number
}

function makeOctaves(rand: () => number, count: number, baseFreq: number, targetPeakAmplitude: number, falloff = 0.62): Octave[] {
  // Geometric falloff: normalize so the octaves' amplitudes sum to roughly targetPeakAmplitude.
  // A gentler falloff (vs. the classic 0.5) spreads weight across more octaves so no single
  // wave direction visually dominates as obvious parallel stripes.
  const falloffSum = (1 - falloff ** count) / (1 - falloff)
  let amp = targetPeakAmplitude / falloffSum
  let freq = baseFreq
  const octaves: Octave[] = []
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    octaves.push({ dirX: Math.cos(angle), dirY: Math.sin(angle), freq, phase: rand() * Math.PI * 2, amp })
    freq *= 1.8 + rand() * 0.7
    amp *= falloff
  }
  return octaves
}

function sumOctaves(octaves: Octave[], x: number, y: number): number {
  let h = 0
  for (const o of octaves) h += o.amp * Math.sin(o.dirX * x * o.freq + o.dirY * y * o.freq + o.phase)
  return h
}

/**
 * A small sum of sine waves alone tends to look like a regular plaid/checker pattern rather
 * than organic terrain, because every octave is a perfectly periodic wave. Domain warping
 * — perturbing the sample position with a second, independent noise field before evaluating
 * the main one — breaks that periodicity up cheaply, without needing true Perlin/Simplex noise.
 */
function warpedSum(octaves: Octave[], warpOctaves: Octave[], warpScale: number, x: number, y: number): number {
  const warp = sumOctaves(warpOctaves, x, y)
  return sumOctaves(octaves, x + warp * warpScale, y - warp * warpScale)
}

/**
 * Builds a deterministic 2D terrain height function from a seed: a fractal sum of sine-wave
 * "octaves" (decreasing amplitude, increasing frequency) approximates rolling natural terrain
 * cheaply, without needing a full Perlin/Simplex noise implementation. The launch pad at (0,0)
 * always sits exactly at `baseAltitude`, whatever style is chosen, so it reads as a stable site.
 */
export function createTerrainSampler(params: TerrainParams): TerrainSampler {
  const rand = mulberry32(params.seed)
  const baseFreq = (2 * Math.PI) / params.featureScale

  if (params.style === 'flat') {
    const octaves = makeOctaves(rand, 3, baseFreq * 3, Math.min(params.reliefAmplitude, 4))
    const originOffset = sumOctaves(octaves, 0, 0)
    return (x, y) => params.baseAltitude + sumOctaves(octaves, x, y) - originOffset
  }

  if (params.style === 'cliff') {
    const rollingOctaves = makeOctaves(rand, 5, baseFreq, params.reliefAmplitude * 0.3)
    const warpOctaves = makeOctaves(rand, 3, baseFreq * 0.7, params.featureScale * 0.4)
    const cliffAngle = rand() * Math.PI * 2
    const cliffDirX = Math.cos(cliffAngle)
    const cliffDirY = Math.sin(cliffAngle)
    const sign = rand() < 0.5 ? 1 : -1
    const cliffOffset = sign * (700 + rand() * 500)
    const cliffWidth = 50 + rand() * 40
    const cliffHeight = params.reliefAmplitude
    const shape = (x: number, y: number) => {
      const d = x * cliffDirX + y * cliffDirY - cliffOffset
      const step = cliffHeight / (1 + Math.exp(-d / cliffWidth))
      return step + warpedSum(rollingOctaves, warpOctaves, 0.9, x, y)
    }
    const originOffset = shape(0, 0)
    return (x, y) => params.baseAltitude + shape(x, y) - originOffset
  }

  // 'rolling' (also the fallback for mountains, dunes, lunar, martian — params tune the look)
  const octaves = makeOctaves(rand, 7, baseFreq, params.reliefAmplitude)
  const warpOctaves = makeOctaves(rand, 3, baseFreq * 0.65, params.featureScale * 0.45)
  const originOffset = warpedSum(octaves, warpOctaves, 0.9, 0, 0)
  return (x, y) => params.baseAltitude + warpedSum(octaves, warpOctaves, 0.9, x, y) - originOffset
}

export interface TerrainProfilePoint {
  distance: number
  height: number
}

/** Samples terrain height along a straight compass bearing from the origin, for side-view rendering. */
export function terrainProfileAlongBearing(
  sampler: TerrainSampler,
  azimuthDeg: number,
  maxDistance: number,
  steps: number,
): TerrainProfilePoint[] {
  const az = azimuthDeg * DEG2RAD
  const dirN = Math.cos(az)
  const dirE = Math.sin(az)
  const points: TerrainProfilePoint[] = []
  for (let i = 0; i <= steps; i++) {
    const distance = (maxDistance * i) / steps
    points.push({ distance, height: sampler(dirE * distance, dirN * distance) })
  }
  return points
}
