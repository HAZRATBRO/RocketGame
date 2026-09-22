import { create } from 'zustand'
import { createTerrainSampler, type TerrainSampler } from '../physics/terrain'
import { DEFAULT_WORLD_PRESET_ID, WORLD_PRESETS, type WorldPreset } from '../physics/worldPresets'

interface WorldState {
  preset: WorldPreset
  seed: number
  terrain: TerrainSampler
  setPreset: (id: string) => void
  randomize: () => void
}

function buildTerrain(preset: WorldPreset, seed: number): TerrainSampler {
  return createTerrainSampler({
    seed,
    style: preset.style,
    baseAltitude: preset.baseAltitude,
    reliefAmplitude: preset.reliefAmplitude,
    featureScale: preset.featureScale,
  })
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

const initialPreset = WORLD_PRESETS.find((p) => p.id === DEFAULT_WORLD_PRESET_ID) ?? WORLD_PRESETS[0]
const initialSeed = randomSeed()

export const useWorldStore = create<WorldState>((set, get) => ({
  preset: initialPreset,
  seed: initialSeed,
  terrain: buildTerrain(initialPreset, initialSeed),

  setPreset: (id) =>
    set(() => {
      const preset = WORLD_PRESETS.find((p) => p.id === id) ?? get().preset
      const seed = randomSeed()
      return { preset, seed, terrain: buildTerrain(preset, seed) }
    }),

  randomize: () =>
    set((state) => {
      const seed = randomSeed()
      return { seed, terrain: buildTerrain(state.preset, seed) }
    }),
}))
