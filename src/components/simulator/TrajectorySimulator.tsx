import { useMemo, useState } from 'react'
import { formatDistance, formatNumber, formatTime } from '../../lib/format'
import { liftoffTWR } from '../../physics/rocket'
import { type SimulationResult, downsample, runSimulation } from '../../physics/simulate'
import { useRocketStore } from '../../store/rocketStore'
import { useWorldStore } from '../../store/worldStore'
import { Card } from '../ui/Card'
import { Stat } from '../ui/Stat'
import { Button, SliderField } from '../ui/fields'
import { FlightAnimation } from './FlightAnimation'
import { AltitudeTimeChart, DynamicPressureChart, TrajectoryProfileChart, VelocityMachChart } from './TrajectoryCharts'

export function TrajectorySimulator() {
  const design = useRocketStore((s) => s.design)
  const world = useWorldStore((s) => s.preset)
  const terrain = useWorldStore((s) => s.terrain)
  const [elevationDeg, setElevationDeg] = useState(80)
  const [result, setResult] = useState<SimulationResult | null>(null)

  const hasEngine = design.components.some((c) => c.type === 'engine')
  const twr = liftoffTWR(design)

  const launch = () => {
    setResult(runSimulation(design, { elevationDeg, azimuthDeg: 0, terrain, environment: world.environment }))
  }

  const chartSamples = useMemo(() => (result ? downsample(result.samples, 400) : []), [result])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <Card title="Launch Configuration" subtitle={`Flying: ${design.name} — ${world.name}`}>
          <div className="space-y-4">
            <SliderField label="Elevation Angle" unit="°" min={5} max={90} value={elevationDeg} onChange={setElevationDeg} />
            <p className="text-xs text-slate-500">{world.description}</p>
            {!hasEngine && <p className="text-xs text-rose-400">Add at least one engine in the Components Creator before simulating.</p>}
            {hasEngine && twr <= 1 && <p className="text-xs text-rose-400">TWR ≤ 1 — rocket cannot lift off. Adjust the design.</p>}
            <Button onClick={launch} disabled={!hasEngine || twr <= 1}>
              Launch Simulation
            </Button>
          </div>
        </Card>

        {result && (
          <Card title="Flight Summary">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Apogee" value={formatNumber(result.summary.apogee, 0)} unit="m" accent="sky" />
              <Stat label="Max Velocity" value={formatNumber(result.summary.maxVelocity, 0)} unit="m/s" />
              <Stat label="Max Mach" value={formatNumber(result.summary.maxMach, 2)} />
              <Stat label="Max Q" value={formatNumber(result.summary.maxDynamicPressure / 1000, 1)} unit="kPa" />
              <Stat label="Max Accel" value={formatNumber(result.summary.maxAccelG, 1)} unit="g" accent="rose" />
              <Stat label="Burnout" value={result.summary.burnoutTime !== null ? formatTime(result.summary.burnoutTime) : '—'} />
              <Stat label="Flight Time" value={formatTime(result.summary.flightTime)} />
              <Stat label="Range" value={formatDistance(result.summary.range)} accent="emerald" />
            </div>
            {!result.summary.landed && (
              <p className="mt-3 text-xs text-amber-400">
                Simulation hit its time cap before landing — range and flight time reflect the cutoff point, not an
                actual touchdown.
              </p>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {!result && (
          <Card>
            <p className="text-sm text-slate-500">
              Configure a launch angle and press <strong>Launch Simulation</strong> to compute and animate this rocket&rsquo;s trajectory.
            </p>
          </Card>
        )}
        {result && result.samples.length > 0 && (
          <>
            <Card title="Flight Animation">
              <FlightAnimation samples={chartSamples} flightTime={result.summary.flightTime} />
            </Card>
            <Card title="Altitude vs Time">
              <AltitudeTimeChart data={chartSamples} />
            </Card>
            <Card title="Trajectory Profile (Altitude vs Downrange)">
              <TrajectoryProfileChart data={chartSamples} groundColor={world.theme.ground} />
            </Card>
            <Card title="Velocity &amp; Mach vs Time">
              <VelocityMachChart data={chartSamples} />
            </Card>
            <Card title="Dynamic Pressure (Q) vs Time">
              <DynamicPressureChart data={chartSamples} />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
