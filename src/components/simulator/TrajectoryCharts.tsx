import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FlightSample } from '../../physics/simulate'

const axisStyle = { fontSize: 11, fill: '#94a3b8' }
const gridStroke = '#1e293b'
const numTick = (v: number) => Number(v.toFixed(1)).toString()

export function AltitudeTimeChart({ data }: { data: FlightSample[] }) {
  const rows = data.map((d) => ({ t: d.t, alt: d.altitude }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={numTick} tick={axisStyle} label={{ value: 'Time (s)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={axisStyle} label={{ value: 'Altitude (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} labelFormatter={(t) => `t = ${t}s`} />
        <Line type="monotone" dataKey="alt" name="Altitude" stroke="#fb923c" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function VelocityMachChart({ data }: { data: FlightSample[] }) {
  const rows = data.map((d) => ({ t: d.t, speed: d.speed, mach: d.mach }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={numTick} tick={axisStyle} label={{ value: 'Time (s)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }} />
        <YAxis yAxisId="left" tick={axisStyle} label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={axisStyle} label={{ value: 'Mach', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} labelFormatter={(t) => `t = ${t}s`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="left" type="monotone" dataKey="speed" name="Speed" stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="mach" name="Mach" stroke="#a78bfa" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function TrajectoryProfileChart({ data }: { data: FlightSample[] }) {
  const rows = data.map((d) => ({ downrange: d.xNorth, alt: d.altitude }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis
          dataKey="downrange"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={numTick}
          tick={axisStyle}
          label={{ value: 'Downrange (m)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }}
        />
        <YAxis tick={axisStyle} label={{ value: 'Altitude (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} />
        <Line type="monotone" dataKey="alt" name="Altitude" stroke="#34d399" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function DynamicPressureChart({ data }: { data: FlightSample[] }) {
  const rows = data.map((d) => ({ t: d.t, q: d.dynamicPressure / 1000 }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={numTick} tick={axisStyle} label={{ value: 'Time (s)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={axisStyle} label={{ value: 'Q (kPa)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }} labelFormatter={(t) => `t = ${t}s`} />
        <Line type="monotone" dataKey="q" name="Dynamic Pressure" stroke="#f472b6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
