import { useMemo, useState } from 'react'
import { formatDistance, formatNumber, formatTime } from '../../lib/format'
import { usePlayback } from '../../lib/usePlayback'
import { liftoffTWR } from '../../physics/rocket'
import { bearingAndDistance, type TargetingResult, solveForTarget } from '../../physics/targeting'
import { useRocketStore } from '../../store/rocketStore'
import { Card } from '../ui/Card'
import { Stat } from '../ui/Stat'
import { Button } from '../ui/fields'
import { MapCanvas, type MapTarget } from './MapCanvas'

let targetIdCounter = 0

export function TargetingMap() {
  const design = useRocketStore((s) => s.design)
  const hasEngine = design.components.some((c) => c.type === 'engine')
  const twr = liftoffTWR(design)
  const canLaunch = hasEngine && twr > 1

  const [targets, setTargets] = useState<MapTarget[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState(8) // meters per pixel
  const [solution, setSolution] = useState<TargetingResult | null>(null)
  const [solving, setSolving] = useState(false)

  const selectedTarget = targets.find((t) => t.id === selectedId) ?? null
  const bearing = selectedTarget ? bearingAndDistance({ x: 0, y: 0 }, { x: selectedTarget.x, y: selectedTarget.y }) : null

  const flightTime = solution?.simulation?.summary.flightTime ?? 0
  const playback = usePlayback(flightTime)

  const flightVisual = useMemo(() => {
    if (!solution?.simulation || !selectedTarget) return null
    return {
      samples: solution.simulation.samples,
      time: playback.time,
      landed: playback.time >= flightTime && flightTime > 0,
      hit: solution.hit,
      targetX: selectedTarget.x,
      targetY: selectedTarget.y,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution, playback.time, selectedTarget, flightTime])

  const handlePick = (xMeters: number, yMeters: number, hitExistingId: string | null) => {
    if (hitExistingId) {
      setSelectedId(hitExistingId)
      setSolution(null)
      return
    }
    const id = `t${targetIdCounter++}`
    const next: MapTarget[] = [...targets, { id, x: xMeters, y: yMeters }].slice(-6)
    setTargets(next)
    setSelectedId(id)
    setSolution(null)
  }

  const computeSolution = () => {
    if (!selectedTarget || !bearing) return
    setSolving(true)
    setSolution(null)
    // Defer slightly so the "Solving..." state paints before the (synchronous) solve runs.
    setTimeout(() => {
      const result = solveForTarget(design, bearing.distance, bearing.azimuthDeg, 0)
      setSolution(result)
      setSolving(false)
    }, 10)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Card
          title="Targeting Map"
          subtitle="Click to place a target, click a marker to select it, then compute a firing solution"
          action={
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => setScale((s) => Math.max(1, s / 1.5))} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">
                +
              </button>
              <span className="w-20 text-center text-slate-400">{formatNumber(scale, 1)} m/px</span>
              <button onClick={() => setScale((s) => Math.min(200, s * 1.5))} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">
                −
              </button>
              <Button
                variant="ghost"
                onClick={() => {
                  setTargets([])
                  setSelectedId(null)
                  setSolution(null)
                }}
              >
                Clear
              </Button>
            </div>
          }
        >
          <MapCanvas
            targets={targets}
            selectedId={selectedId}
            scaleMetersPerPixel={scale}
            onPick={handlePick}
            flight={flightVisual}
          />
        </Card>

        {solution?.simulation && (
          <Card title="Launch Playback">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={playback.playing ? playback.pause : playback.play}>
                {playback.playing ? 'Pause' : 'Launch'}
              </Button>
              <Button variant="ghost" onClick={playback.reset}>
                Reset
              </Button>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                {[0.5, 1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => playback.setSpeed(s)}
                    className={`rounded px-2 py-1 ${playback.speed === s ? 'bg-orange-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={flightTime}
                step={flightTime / 500 || 0.01}
                value={playback.time}
                onChange={(e) => playback.setTime(Number.parseFloat(e.target.value))}
                className="min-w-[140px] flex-1 accent-orange-500"
              />
              <span className="w-16 text-right text-xs text-slate-400">{formatTime(playback.time)}</span>
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {!hasEngine && (
          <Card>
            <p className="text-xs text-rose-400">Build a rocket with at least one engine in the Components Creator tab first.</p>
          </Card>
        )}
        {hasEngine && twr <= 1 && (
          <Card>
            <p className="text-xs text-rose-400">Current design has TWR ≤ 1 and cannot fly. Adjust it in the Components Creator.</p>
          </Card>
        )}

        <Card title="Selected Target">
          {!selectedTarget && <p className="text-sm text-slate-500">Click the map to place a target.</p>}
          {selectedTarget && bearing && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Distance" value={formatDistance(bearing.distance)} accent="sky" />
              <Stat label="Bearing" value={formatNumber(bearing.azimuthDeg, 1)} unit="°" />
            </div>
          )}
          <div className="mt-3">
            <Button onClick={computeSolution} disabled={!selectedTarget || !canLaunch || solving}>
              {solving ? 'Solving…' : 'Compute Firing Solution'}
            </Button>
          </div>
        </Card>

        {solution && (
          <Card title="Firing Solution">
            {!solution.hit && !solution.simulation && (
              <p className="text-sm text-rose-400">{solution.reason}</p>
            )}
            {solution.simulation && (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Elevation" value={formatNumber(solution.elevationDeg, 2)} unit="°" accent="orange" />
                <Stat label="Azimuth" value={formatNumber(solution.azimuthDeg, 1)} unit="°" />
                <Stat label="Achieved Range" value={formatDistance(solution.achievedRange)} />
                <Stat label="Miss Distance" value={formatDistance(solution.missDistance)} accent={solution.hit ? 'emerald' : 'rose'} />
                <Stat label="Apogee" value={formatDistance(solution.simulation.summary.apogee)} />
                <Stat label="Flight Time" value={formatTime(solution.simulation.summary.flightTime)} />
              </div>
            )}
            {solution.simulation && (
              <p className={`mt-3 text-sm font-semibold ${solution.hit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {solution.hit ? 'Target within range — solution locked in.' : 'Closest achievable solution — will miss slightly.'}
              </p>
            )}
          </Card>
        )}

        <Card title="How Targeting Works" subtitle="Shooting method">
          <p className="text-xs leading-relaxed text-slate-400">
            The azimuth is set directly from the bearing to the target. The elevation angle is found numerically: the
            simulator is run repeatedly across a range of elevation angles, bracketing where the landing point crosses
            the target distance, then bisecting to refine it. See the Physics Info tab for the full method.
          </p>
        </Card>
      </div>
    </div>
  )
}
