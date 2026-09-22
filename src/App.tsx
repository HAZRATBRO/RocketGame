import { useState } from 'react'
import { ComponentsCreator } from './components/creator/ComponentsCreator'
import { PhysicsInfo } from './components/physics-info/PhysicsInfo'
import { TrajectorySimulator } from './components/simulator/TrajectorySimulator'
import { TargetingMap } from './components/targeting/TargetingMap'
import { WorldSelector } from './components/world/WorldSelector'

type Tab = 'simulator' | 'creator' | 'physics' | 'targeting'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'simulator', label: 'Trajectory Simulator', icon: '\u{1F680}' },
  { id: 'creator', label: 'Components Creator', icon: '\u{1F527}' },
  { id: 'targeting', label: 'Targeting Map', icon: '\u{1F3AF}' },
  { id: 'physics', label: 'Physics Info', icon: '\u{1F4D0}' },
]

function App() {
  const [tab, setTab] = useState<Tab>('simulator')

  return (
    <div className="min-h-screen text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{'\u{1F680}'}</span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-50">Rocket Trajectory Lab</h1>
              <p className="text-xs text-slate-500">Physics-based rocket design, simulation &amp; targeting</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span className="mr-1.5">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </nav>
            <WorldSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {tab === 'simulator' && <TrajectorySimulator />}
        {tab === 'creator' && <ComponentsCreator />}
        {tab === 'targeting' && <TargetingMap />}
        {tab === 'physics' && <PhysicsInfo />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-600">
        Simplified physics model for educational and hobby-rocketry exploration — not for real-world trajectory prediction.
      </footer>
    </div>
  )
}

export default App
