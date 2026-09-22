import { useEffect, useRef } from 'react'
import { findTimeIndex, lerp, setupHiDPICanvas } from '../../lib/canvas'
import { usePlayback } from '../../lib/usePlayback'
import type { FlightSample } from '../../physics/simulate'
import { Button } from '../ui/fields'
import { formatTime } from '../../lib/format'

const PADDING = { top: 20, right: 20, bottom: 30, left: 55 }

export function FlightAnimation({ samples, flightTime }: { samples: FlightSample[]; flightTime: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { time, setTime, playing, play, pause, reset, speed, setSpeed } = usePlayback(flightTime)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || samples.length === 0) return

    const width = container.clientWidth
    const height = 280
    const ctx = setupHiDPICanvas(canvas, width, height)

    const maxDownrange = Math.max(...samples.map((s) => s.xNorth), 1)
    const maxAlt = Math.max(...samples.map((s) => s.altitude), 1)
    const plotW = width - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom

    const sx = (x: number) => PADDING.left + (x / maxDownrange) * plotW
    const sy = (y: number) => PADDING.top + plotH - (y / maxAlt) * plotH

    ctx.clearRect(0, 0, width, height)

    // background
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, width, height)

    // grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const gy = PADDING.top + (plotH * i) / 4
      ctx.beginPath()
      ctx.moveTo(PADDING.left, gy)
      ctx.lineTo(width - PADDING.right, gy)
      ctx.stroke()
      ctx.fillStyle = '#64748b'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(Math.round(maxAlt * (1 - i / 4)).toString(), PADDING.left - 6, gy + 3)
    }

    // ground
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PADDING.left, sy(0))
    ctx.lineTo(width - PADDING.right, sy(0))
    ctx.stroke()

    // full path (faint)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2
    ctx.beginPath()
    samples.forEach((s, i) => {
      const px = sx(s.xNorth)
      const py = sy(Math.max(s.altitude, 0))
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // traveled path (bright) up to current time
    const { index, frac } = findTimeIndex(samples, time)
    const curX = lerp(samples[index].xNorth, samples[Math.min(index + 1, samples.length - 1)].xNorth, frac)
    const curAlt = Math.max(lerp(samples[index].altitude, samples[Math.min(index + 1, samples.length - 1)].altitude, frac), 0)
    const curSpeed = lerp(samples[index].speed, samples[Math.min(index + 1, samples.length - 1)].speed, frac)
    const curThrust = lerp(samples[index].thrust, samples[Math.min(index + 1, samples.length - 1)].thrust, frac)

    ctx.strokeStyle = '#fb923c'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    let started = false
    for (const s of samples) {
      if (s.t > time) break
      const px = sx(s.xNorth)
      const py = sy(Math.max(s.altitude, 0))
      if (!started) {
        ctx.moveTo(px, py)
        started = true
      } else ctx.lineTo(px, py)
    }
    ctx.lineTo(sx(curX), sy(curAlt))
    ctx.stroke()

    // rocket marker
    const rx = sx(curX)
    const ry = sy(curAlt)
    // heading angle from velocity direction (approx via nearby samples)
    const next = samples[Math.min(index + 1, samples.length - 1)]
    const prev = samples[index]
    const heading = Math.atan2(sy(Math.max(next.altitude, 0)) - sy(Math.max(prev.altitude, 0)), sx(next.xNorth) - sx(prev.xNorth))

    ctx.save()
    ctx.translate(rx, ry)
    ctx.rotate(heading + Math.PI / 2)
    if (curThrust > 1) {
      ctx.beginPath()
      ctx.moveTo(-3, 8)
      ctx.lineTo(0, 8 + 6 + Math.min(curThrust / 200, 14))
      ctx.lineTo(3, 8)
      ctx.closePath()
      ctx.fillStyle = '#fbbf24'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(4, 8)
    ctx.lineTo(-4, 8)
    ctx.closePath()
    ctx.fillStyle = '#f8fafc'
    ctx.fill()
    ctx.restore()

    // readout
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`t = ${time.toFixed(1)}s  alt = ${Math.round(curAlt)}m  v = ${Math.round(curSpeed)}m/s`, PADDING.left, 14)

    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'
    ctx.fillText('Downrange (m)', PADDING.left + plotW / 2, height - 6)
  }, [samples, time])

  if (samples.length === 0) return null

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full rounded-lg" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={playing ? pause : play}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Reset
        </Button>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-1 ${speed === s ? 'bg-orange-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}
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
          value={time}
          onChange={(e) => setTime(Number.parseFloat(e.target.value))}
          className="min-w-[140px] flex-1 accent-orange-500"
        />
        <span className="w-16 text-right text-xs text-slate-400">{formatTime(time)}</span>
      </div>
    </div>
  )
}
