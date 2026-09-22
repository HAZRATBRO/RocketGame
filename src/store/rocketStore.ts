import { create } from 'zustand'
import { PRESET_DESIGNS, clonePreset } from '../physics/presets'
import { type NewRocketComponent, type RocketComponent, type RocketDesign, newComponentId } from '../physics/rocket'

interface RocketStore {
  design: RocketDesign
  addComponent: (partial: NewRocketComponent) => void
  updateComponent: (id: string, updates: Partial<RocketComponent>) => void
  removeComponent: (id: string) => void
  moveComponent: (id: string, direction: 'up' | 'down') => void
  renameDesign: (name: string) => void
  loadPreset: (presetId: string) => void
  resetDesign: () => void
}

function emptyDesign(): RocketDesign {
  return { id: `design-${Date.now().toString(36)}`, name: 'Untitled Rocket', components: [] }
}

export const useRocketStore = create<RocketStore>((set) => ({
  design: clonePreset(PRESET_DESIGNS[0]),

  addComponent: (partial) =>
    set((state) => ({
      design: {
        ...state.design,
        components: [...state.design.components, { ...partial, id: newComponentId() } as RocketComponent],
      },
    })),

  updateComponent: (id, updates) =>
    set((state) => ({
      design: {
        ...state.design,
        components: state.design.components.map((c) => (c.id === id ? ({ ...c, ...updates } as RocketComponent) : c)),
      },
    })),

  removeComponent: (id) =>
    set((state) => ({
      design: { ...state.design, components: state.design.components.filter((c) => c.id !== id) },
    })),

  moveComponent: (id, direction) =>
    set((state) => {
      const list = [...state.design.components]
      const idx = list.findIndex((c) => c.id === id)
      if (idx === -1) return state
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= list.length) return state
      ;[list[idx], list[target]] = [list[target], list[idx]]
      return { design: { ...state.design, components: list } }
    }),

  renameDesign: (name) => set((state) => ({ design: { ...state.design, name } })),

  loadPreset: (presetId) =>
    set(() => {
      const preset = PRESET_DESIGNS.find((p) => p.id === presetId)
      return { design: preset ? clonePreset(preset) : emptyDesign() }
    }),

  resetDesign: () => set(() => ({ design: emptyDesign() })),
}))
