import { useMemo, useState } from 'react'
import { formatDistance, formatNumber, formatTime } from '../../lib/format'
import { usePlayback } from '../../lib/usePlayback'
import { type MirvPlan, MAX_MIRV_WARHEADS, planMirvStrike } from '../../physics/mirv'
import { liftoffTWR } from '../../physics/rocket'
import { bearingAndDistance, type TargetingResult, solveForTarget } from '../../physics/targeting'
import { useRocketStore } from '../../store/rocketStore'
import { useWorldStore } from '../../store/worldStore'
import { Card } from '../ui/Card'
import { Stat } from '../ui/Stat'
import { Button } from '../ui/fields'
import { MapCanvas, type MapTarget, type MirvWarheadVisual } from './MapCanvas'

let targetIdCounter = 0
const MIRV_COLORS = ['#fbbf24', '#38bdf8', '#a78bfa', '#f472b6']

export function TargetingMap() {
  const design = useRocketStore((s) => s.design)
  const world = useWorldStore((s) => s.preset)
  const terrain = useWorldStore((s) => s.terrain)
  const hasEngine = design.components.some((c) => c.type === 'engine')
  const twr = liftoffTWR(design)
  const canLaunch = hasEngine && twr > 1

  const [targets, setTargets] = useState<MapTarget[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState(8) // meters per pixel
  const [mirvMode, setMirvMode] = useState(false)
  const [solution, setSolution] = useState<TargetingResult | null>(null)
  const [mirvPlan, setMirvPlan] = useState<MirvPlan | null>(null)
  const [solving, setSolving] = useState(false)

  const selectedTarget = targets.find((t) => t.id === selectedId) ?? null
  const bearing = selectedTarget ? bearingAndDistance({ x: 0, y: 0 }, { x: selectedTarget.x, y: selectedTarget.y }) : null

  const singleFlightTime = solution?.simulation?.summary.flightTime ?? 0
  const mirvFlightTime = useMemo(() => {
    if (!mirvPlan) return 0
    const boostEnd = mirvPlan.boostSamples[mirvPlan.boostSamples.length - 1]?.t ?? 0
    const warheadEnds = mirvPlan.warheads.map((w) => w.samples[w.samples.length - 1]?.t ?? 0)
    return Math.max(boostEnd, ...warheadEnds, 0)
  }, [mirvPlan])
  const duration = mirvMode ? mirvFlightTime : singleFlightTime
  const playback = usePlayback(duration)

  const flightVisual = useMemo(() => {
    if (mirvMode || !solution?.simulation || !selectedTarget) return null
    return {
      samples: solution.simulation.samples,
      time: playback.time,
      landed: playback.time >= singleFlightTime && singleFlightTime > 0,
      hit: solution.hit,
      targetX: selectedTarget.x,
      targetY: selectedTarget.y,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirvMode, solution, playback.time, selectedTarget, singleFlightTime])

  const mirvVisual = useMemo(() => {
    if (!mirvMode || !mirvPlan) return null
    const warheads: MirvWarheadVisual[] = mirvPlan.warheads.map((w, i) => {
      const target = targets.find((t) => t.id === w.targetId)
      return {
        samples: w.samples,
        targetX: target?.x ?? 0,
        targetY: target?.y ?? 0,
        hit: w.hit,
        color: MIRV_COLORS[i % MIRV_COLORS.length],
      }
    })
    return { boostSamples: mirvPlan.boostSamples, releaseTime: mirvPlan.releaseTime, time: playback.time, warheads }
  }, [mirvMode, mirvPlan, playback.time, targets])

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
    setMirvPlan(null)
  }

  const computeSolution = () => {
    setSolving(true)
    if (mirvMode) {
      setMirvPlan(null)
      setTimeout(() => {
        const plan = planMirvStrike(
          design,
          targets.map((t) => ({ id: t.id, xEast: t.x, xNorth: t.y })),
          world.environment,
          terrain,
        )
        setMirvPlan(plan)
        setSolving(false)
      }, 10)
      return
    }
    if (!selectedTarget || !bearing) {
      setSolving(false)
      return
    }
    setSolution(null)
    setTimeout(() => {
      const result = solveForTarget(design, bearing.distance, bearing.azimuthDeg, { environment: world.environment, terrain })
      setSolution(result)
      setSolving(false)
    }, 10)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Card
          title="Targeting Map"
          subtitle={
            mirvMode
              ? `MIRV mode — place up to ${MAX_MIRV_WARHEADS} targets, then plan a strike`
              : 'Click to place a target, click a marker to select it, then compute a firing solution'
          }
          action={
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 rounded-md bg-slate-900 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={mirvMode}
                  onChange={(e) => {
                    setMirvMode(e.target.checked)
                    setSolution(null)
                    setMirvPlan(null)
                  }}
                />
                MIRV
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => setScale((s) => Math.max(1, s / 1.5))} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">
                  +
                </button>
                <span className="w-20 text-center text-slate-400">{formatNumber(scale, 1)} m/px</span>
                <button onClick={() => setScale((s) => Math.min(200, s * 1.5))} className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">
                  −
                </button>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setTargets([])
                  setSelectedId(null)
                  setSolution(null)
                  setMirvPlan(null)
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
            terrain={terrain}
            theme={world.theme}
            flight={flightVisual}
            mirv={mirvVisual}
          />
        </Card>

        {(solution?.simulation || mirvPlan) && (
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
                max={duration}
                step={duration / 500 || 0.01}
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

        {!mirvMode && (
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
        )}

        {mirvMode && (
          <Card title={`MIRV Targets (${targets.length}/${MAX_MIRV_WARHEADS})`}>
            {targets.length === 0 && <p className="text-sm text-slate-500">Click the map to place up to {MAX_MIRV_WARHEADS} targets.</p>}
            {targets.length > 0 && targets.length < 2 && <p className="text-xs text-amber-400">Place at least 2 targets for a meaningful MIRV strike.</p>}
            <div className="mt-2">
              <Button onClick={computeSolution} disabled={targets.length === 0 || !canLaunch || solving}>
                {solving ? 'Planning…' : 'Plan MIRV Strike'}
              </Button>
            </div>
          </Card>
        )}

        {!mirvMode && solution && (
          <Card title="Firing Solution">
            {!solution.hit && !solution.simulation && <p className="text-sm text-rose-400">{solution.reason}</p>}
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

        {mirvMode && mirvPlan && (
          <Card title="MIRV Strike Plan">
            {mirvPlan.warheads.length === 0 && <p className="text-sm text-rose-400">{mirvPlan.reason}</p>}
            <div className="space-y-2">
              {mirvPlan.warheads.map((w, i) => (
                <div key={w.targetId} className="rounded-lg bg-slate-950/50 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MIRV_COLORS[i % MIRV_COLORS.length] }} />
                      Warhead {i + 1}
                    </span>
                    <span className={w.hit ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>{w.hit ? 'HIT' : 'MISS'}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 text-slate-400">
                    <span>Elev: {formatNumber(w.elevationDeg, 1)}°</span>
                    <span>Az: {formatNumber(w.azimuthDeg, 1)}°</span>
                    <span>Miss: {formatDistance(w.missDistance)}</span>
                    {w.reason && <span className="col-span-2 text-rose-400">{w.reason}</span>}
                  </div>
                </div>
              ))}
            </div>
            {mirvPlan.warheads.length > 0 && (
              <p className={`mt-3 text-sm font-semibold ${mirvPlan.hit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {mirvPlan.hit ? 'All warheads on target.' : 'One or more warheads will miss.'}
              </p>
            )}
          </Card>
        )}

        <Card title="How Targeting Works" subtitle="Shooting method">
          <p className="text-xs leading-relaxed text-slate-400">
            {mirvMode
              ? "The shared booster is aimed at the target cluster's centroid and separates at burnout. Each warhead then re-aims independently — same speed, its own azimuth toward its target, and a bisected elevation — solving its own miniature shooting problem from the release point. Warhead reach is limited by the booster's burnout speed, so a small, short-burning motor may not have enough energy to cover a widely spread cluster — a bigger or longer-burning engine in the Components Creator gives warheads more room to maneuver."
              : "The azimuth is set directly from the bearing to the target. The elevation angle is found numerically: the simulator is run repeatedly across a range of elevation angles, bracketing where the landing point crosses the target distance, then bisecting to refine it."}{' '}
            See the Physics Info tab for the full method.
          </p>
        </Card>
      </div>
    </div>
  )
}
