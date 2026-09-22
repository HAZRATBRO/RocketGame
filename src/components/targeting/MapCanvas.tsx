import { type MouseEvent, useEffect, useRef } from 'react'
import { findTimeIndex, lerp, setupHiDPICanvas } from '../../lib/canvas'
import type { FlightSample } from '../../physics/simulate'

export interface MapTarget {
  id: string
  x: number // meters, east of launch
  y: number // meters, north of launch
}

interface FlightVisual {
  samples: FlightSample[]
  time: number
  landed: boolean
  hit: boolean
  targetX: number
  targetY: number
}

const HEIGHT = 420

function toPixelWithScale(width: number, height: number, xM: number, yM: number, scale: number) {
  return { px: width / 2 + xM / scale, py: height / 2 - yM / scale }
}

export function MapCanvas({
  targets,
  selectedId,
  scaleMetersPerPixel,
  onPick,
  flight,
}: {
  targets: MapTarget[]
  selectedId: string | null
  scaleMetersPerPixel: number
  onPick: (xMeters: number, yMeters: number, hitExistingId: string | null) => void
  flight: FlightVisual | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const toPixel = (width: number, height: number, xM: number, yM: number) => toPixelWithScale(width, height, xM, yM, scaleMetersPerPixel)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const width = container.clientWidth
    const height = HEIGHT
    const ctx = setupHiDPICanvas(canvas, width, height)

    ctx.fillStyle = '#08101f'
    ctx.fillRect(0, 0, width, height)

    const centerX = width / 2
    const centerY = height / 2

    // range rings
    const niceStep = pickRingStep(scaleMetersPerPixel, Math.min(width, height) / 2)
    ctx.strokeStyle = '#1e293b'
    ctx.fillStyle = '#475569'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    for (let r = niceStep; r < (Math.min(width, height) / 2) * scaleMetersPerPixel; r += niceStep) {
      const pr = r / scaleMetersPerPixel
      ctx.beginPath()
      ctx.arc(centerX, centerY, pr, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillText(`${Math.round(r)} m`, centerX + 4, centerY - pr + 10)
    }

    // compass cross
    ctx.strokeStyle = '#334155'
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, height)
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
    ctx.fillStyle = '#64748b'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('N', centerX, 14)
    ctx.fillText('S', centerX, height - 6)
    ctx.textAlign = 'left'
    ctx.fillText('E', width - 14, centerY + 4)
    ctx.fillText('W', 6, centerY + 4)

    // launch site
    ctx.fillStyle = '#38bdf8'
    ctx.beginPath()
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0ea5e9'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#7dd3fc'
    ctx.font = '11px sans-serif'
    ctx.fillText('Launch Site', centerX + 10, centerY - 8)

    // targets
    for (const target of targets) {
      const { px, py } = toPixelWithScale(width, height, target.x, target.y, scaleMetersPerPixel)
      const selected = target.id === selectedId
      ctx.strokeStyle = selected ? '#fbbf24' : '#f87171'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px, py, 9, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(px - 13, py)
      ctx.lineTo(px + 13, py)
      ctx.moveTo(px, py - 13)
      ctx.lineTo(px, py + 13)
      ctx.strokeStyle = selected ? '#fbbf24' : '#ef4444'
      ctx.stroke()
    }

    // flight ground track + rocket marker
    if (flight && flight.samples.length > 0) {
      const { px: tpx, py: tpy } = toPixelWithScale(width, height, flight.targetX, flight.targetY, scaleMetersPerPixel)

      ctx.strokeStyle = '#fb923c'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(tpx, tpy)
      ctx.stroke()
      ctx.setLineDash([])

      const { index, frac } = findTimeIndex(flight.samples, flight.time)
      const next = flight.samples[Math.min(index + 1, flight.samples.length - 1)]
      const curX = lerp(flight.samples[index].xEast, next.xEast, frac)
      const curY = lerp(flight.samples[index].xNorth, next.xNorth, frac)
      const curAlt = lerp(flight.samples[index].altitude, next.altitude, frac)
      const { px: rpx, py: rpy } = toPixelWithScale(width, height, curX, curY, scaleMetersPerPixel)

      // traveled trail
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      let started = false
      for (const s of flight.samples) {
        if (s.t > flight.time) break
        const { px, py } = toPixelWithScale(width, height, s.xEast, s.xNorth, scaleMetersPerPixel)
        if (!started) {
          ctx.moveTo(px, py)
          started = true
        } else ctx.lineTo(px, py)
      }
      ctx.lineTo(rpx, rpy)
      ctx.stroke()

      // rocket marker, size hints at altitude
      const markerR = 4 + Math.min(curAlt / 500, 10)
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.arc(rpx, rpy, markerR, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fb923c'
      ctx.lineWidth = 1.5
      ctx.stroke()

      if (flight.landed) {
        ctx.fillStyle = flight.hit ? '#4ade80' : '#f87171'
        ctx.beginPath()
        ctx.arc(rpx, rpy, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText(flight.hit ? 'HIT' : 'MISS', rpx + 12, rpy + 4)
      }
    }
  }, [targets, selectedId, scaleMetersPerPixel, flight])

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const width = container.clientWidth
    const height = HEIGHT
    const xMeters = (px - width / 2) * scaleMetersPerPixel
    const yMeters = -(py - height / 2) * scaleMetersPerPixel

    let hitId: string | null = null
    for (const target of targets) {
      const { px: tpx, py: tpy } = toPixel(width, height, target.x, target.y)
      if (Math.hypot(tpx - px, tpy - py) < 14) {
        hitId = target.id
        break
      }
    }
    onPick(xMeters, yMeters, hitId)
  }

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} onClick={handleClick} className="w-full cursor-crosshair rounded-lg" />
    </div>
  )
}

function pickRingStep(metersPerPixel: number, maxRadiusPx: number): number {
  const maxMeters = metersPerPixel * maxRadiusPx
  const rough = maxMeters / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2.5 : normalized < 7.5 ? 5 : 10
  return nice * magnitude
}
