import { useWorldStore } from '../../store/worldStore'
import { WORLD_PRESETS } from '../../physics/worldPresets'

export function WorldSelector() {
  const preset = useWorldStore((s) => s.preset)
  const setPreset = useWorldStore((s) => s.setPreset)
  const randomize = useWorldStore((s) => s.randomize)

  return (
    <div className="flex items-center gap-1.5" title={preset.description}>
      <span className="hidden text-xs text-slate-500 sm:inline">World</span>
      <select
        value={preset.id}
        onChange={(e) => setPreset(e.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-orange-500"
      >
        {WORLD_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={randomize}
        title="Randomize terrain (same world)"
        className="rounded-md bg-slate-900 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
      >
        {'\u{1F3B2}'}
      </button>
    </div>
  )
}
