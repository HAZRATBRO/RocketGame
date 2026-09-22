import { useEffect, useRef } from 'react'
import { findTimeIndex, lerp, setupHiDPICanvas } from '../../lib/canvas'
import { formatTime } from '../../lib/format'
import { usePlayback } from '../../lib/usePlayback'
import type { FlightSample } from '../../physics/simulate'
import { useWorldStore } from '../../store/worldStore'
import { Button } from '../ui/fields'

const PADDING = { top: 20, right: 20, bottom: 30, left: 55 }

export function FlightAnimation({ samples, flightTime }: { samples: FlightSample[]; flightTime: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useWorldStore((s) => s.preset.theme)
  const { time, setTime, playing, play, pause, reset, speed, setSpeed } = usePlayback(flightTime)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || samples.length === 0) return

    const width = container.clientWidth
    const height = 280
    const ctx = setupHiDPICanvas(canvas, width, height)

    const terrainHeights = samples.map((s) => s.terrainHeight)
    const maxAlt = Math.max(...samples.map((s) => s.altitude), ...terrainHeights, 1)
    const minAlt = Math.min(...terrainHeights, 0)
    const altRange = maxAlt - minAlt || 1
    const maxDownrange = Math.max(...samples.map((s) => s.xNorth), 1)
    const plotW = width - PADDING.left - PADDING.right
    const plotH = height - PADDING.top - PADDING.bottom

    const sx = (x: number) => PADDING.left + (x / maxDownrange) * plotW
    const sy = (y: number) => PADDING.top + plotH - ((y - minAlt) / altRange) * plotH

    ctx.clearRect(0, 0, width, height)

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, theme.sky[0])
    sky.addColorStop(1, theme.sky[1])
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, width, height)

    // altitude grid
    ctx.strokeStyle = '#ffffff22'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const gy = PADDING.top + (plotH * i) / 4
      ctx.beginPath()
      ctx.moveTo(PADDING.left, gy)
      ctx.lineTo(width - PADDING.right, gy)
      ctx.stroke()
      ctx.fillStyle = '#e2e8f0aa'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(Math.round(maxAlt - (altRange * i) / 4).toString(), PADDING.left - 6, gy + 3)
    }

    // terrain silhouette, sampled from the same heights the physics engine actually collided with
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(minAlt))
    samples.forEach((s) => ctx.lineTo(sx(s.xNorth), sy(s.terrainHeight)))
    ctx.lineTo(sx(samples[samples.length - 1].xNorth), sy(minAlt))
    ctx.closePath()
    const groundGrad = ctx.createLinearGradient(0, sy(maxAlt), 0, sy(minAlt))
    groundGrad.addColorStop(0, theme.groundHigh)
    groundGrad.addColorStop(1, theme.ground)
    ctx.fillStyle = groundGrad
    ctx.fill()
    ctx.strokeStyle = theme.groundHigh
    ctx.lineWidth = 1.5
    ctx.beginPath()
    samples.forEach((s, i) => {
      const px = sx(s.xNorth)
      const py = sy(s.terrainHeight)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // full flight path (faint)
    ctx.strokeStyle = '#ffffff55'
    ctx.lineWidth = 2
    ctx.beginPath()
    samples.forEach((s, i) => {
      const px = sx(s.xNorth)
      const py = sy(s.altitude)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()

    // traveled path (bright) up to current time
    const { index, frac } = findTimeIndex(samples, time)
    const nextIdx = Math.min(index + 1, samples.length - 1)
    const curX = lerp(samples[index].xNorth, samples[nextIdx].xNorth, frac)
    const curAlt = lerp(samples[index].altitude, samples[nextIdx].altitude, frac)
    const curSpeed = lerp(samples[index].speed, samples[nextIdx].speed, frac)
    const curThrust = lerp(samples[index].thrust, samples[nextIdx].thrust, frac)

    ctx.strokeStyle = '#fb923c'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    let started = false
    for (const s of samples) {
      if (s.t > time) break
      const px = sx(s.xNorth)
      const py = sy(s.altitude)
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
    const next = samples[nextIdx]
    const prev = samples[index]
    const heading = Math.atan2(sy(next.altitude) - sy(prev.altitude), sx(next.xNorth) - sx(prev.xNorth))

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
    ctx.fillStyle = '#f1f5f9'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`t = ${time.toFixed(1)}s  alt = ${Math.round(curAlt)}m  v = ${Math.round(curSpeed)}m/s`, PADDING.left, 14)

    ctx.fillStyle = '#e2e8f0aa'
    ctx.textAlign = 'center'
    ctx.fillText('Downrange (m)', PADDING.left + plotW / 2, height - 6)
  }, [samples, time, theme])

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
