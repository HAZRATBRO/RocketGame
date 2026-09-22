import type { Environment } from './environment'
import type { TerrainStyle } from './terrain'

export interface WorldTheme {
  sky: [string, string] // gradient stops, top -> horizon
  ground: string
  groundHigh: string
  accent: string
}

export interface WorldPreset {
  id: string
  name: string
  description: string
  style: TerrainStyle
  baseAltitude: number
  reliefAmplitude: number
  featureScale: number
  environment: Environment
  theme: WorldTheme
}

export const WORLD_PRESETS: WorldPreset[] = [
  {
    id: 'plains',
    name: 'Flat Proving Ground',
    description: 'Sea-level, Earth gravity, near-zero relief — a clean baseline for testing a design.',
    style: 'flat',
    baseAltitude: 0,
    reliefAmplitude: 2,
    featureScale: 600,
    environment: { gravityMultiplier: 1, airDensityMultiplier: 1, temperatureOffsetK: 0, airless: false },
    theme: { sky: ['#1e3a5f', '#0b1220'], ground: '#3f6b3a', groundHigh: '#5a8a52', accent: '#38bdf8' },
  },
  {
    id: 'hills',
    name: 'Rolling Hills',
    description: 'Earth physics over gentle terrain — watch for hillsides short of the target.',
    style: 'rolling',
    baseAltitude: 150,
    reliefAmplitude: 120,
    featureScale: 900,
    environment: { gravityMultiplier: 1, airDensityMultiplier: 1, temperatureOffsetK: 0, airless: false },
    theme: { sky: ['#234a5f', '#0b1220'], ground: '#4a7a3f', groundHigh: '#7a9a52', accent: '#38bdf8' },
  },
  {
    id: 'mountains',
    name: 'Mountain Range',
    description: 'High-altitude launch site with thinner air and tall, sharp relief.',
    style: 'rolling',
    baseAltitude: 1800,
    reliefAmplitude: 950,
    featureScale: 700,
    environment: { gravityMultiplier: 1, airDensityMultiplier: 1, temperatureOffsetK: -12, airless: false },
    theme: { sky: ['#3a4a6f', '#0b1220'], ground: '#5a5a5f', groundHigh: '#eef2f5', accent: '#a78bfa' },
  },
  {
    id: 'coast',
    name: 'Coastal Cliffs',
    description: 'Sea level with a sharp escarpment nearby — standard Earth physics.',
    style: 'cliff',
    baseAltitude: 0,
    reliefAmplitude: 90,
    featureScale: 500,
    environment: { gravityMultiplier: 1, airDensityMultiplier: 1, temperatureOffsetK: 0, airless: false },
    theme: { sky: ['#1e4a5f', '#0b1220'], ground: '#4a6b4f', groundHigh: '#8a8a6f', accent: '#38bdf8' },
  },
  {
    id: 'desert',
    name: 'Desert Dunes',
    description: 'Hot, high plateau with small rolling dunes — thinner, warmer air than sea level.',
    style: 'rolling',
    baseAltitude: 420,
    reliefAmplitude: 55,
    featureScale: 260,
    environment: { gravityMultiplier: 1, airDensityMultiplier: 1, temperatureOffsetK: 18, airless: false },
    theme: { sky: ['#5f4a2a', '#1a1208'], ground: '#c9a24a', groundHigh: '#e8c878', accent: '#fb923c' },
  },
  {
    id: 'lunar',
    name: 'Lunar Surface',
    description: 'No atmosphere at all and 1/6 g — no drag, no max-Q, enormous ranges.',
    style: 'rolling',
    baseAltitude: 0,
    reliefAmplitude: 220,
    featureScale: 500,
    environment: { gravityMultiplier: 0.166, airDensityMultiplier: 0, temperatureOffsetK: 0, airless: true },
    theme: { sky: ['#0a0a12', '#000000'], ground: '#8a8a8a', groundHigh: '#d8d8d8', accent: '#f8fafc' },
  },
  {
    id: 'mars',
    name: 'Martian Terrain',
    description: 'About a third of Earth gravity and a thin CO₂ atmosphere — light drag, long flight times.',
    style: 'rolling',
    baseAltitude: 500,
    reliefAmplitude: 420,
    featureScale: 650,
    environment: { gravityMultiplier: 0.379, airDensityMultiplier: 0.012, temperatureOffsetK: -60, airless: false },
    theme: { sky: ['#5a2a1a', '#160a06'], ground: '#9a4a2f', groundHigh: '#c97a4f', accent: '#f87171' },
  },
]

export const DEFAULT_WORLD_PRESET_ID = 'plains'
