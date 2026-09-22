import { type MouseEvent, useEffect, useRef } from 'react'
import { findTimeIndex, lerp, setupHiDPICanvas } from '../../lib/canvas'
import { hexToRgb, lerpColor } from '../../lib/color'
import type { FlightSample } from '../../physics/simulate'
import type { TerrainSampler } from '../../physics/terrain'
import type { WorldTheme } from '../../physics/worldPresets'

export interface MapTarget {
  id: string
  x: number // meters, east of launch
  y: number // meters, north of launch
}

interface SingleFlightVisual {
  samples: FlightSample[]
  time: number
  landed: boolean
  hit: boolean
  targetX: number
  targetY: number
}

export interface MirvWarheadVisual {
  samples: FlightSample[]
  targetX: number
  targetY: number
  hit: boolean
  color: string
}

interface MirvFlightVisual {
  boostSamples: FlightSample[]
  releaseTime: number
  time: number
  warheads: MirvWarheadVisual[]
}

const HEIGHT = 420
const HEIGHTMAP_GRID_W = 160

function toPixelWithScale(width: number, height: number, xM: number, yM: number, scale: number) {
  return { px: width / 2 + xM / scale, py: height / 2 - yM / scale }
}

export function MapCanvas({
  targets,
  selectedId,
  scaleMetersPerPixel,
  onPick,
  terrain,
  theme,
  flight,
  mirv,
}: {
  targets: MapTarget[]
  selectedId: string | null
  scaleMetersPerPixel: number
  onPick: (xMeters: number, yMeters: number, hitExistingId: string | null) => void
  terrain: TerrainSampler
  theme: WorldTheme
  flight: SingleFlightVisual | null
  mirv: MirvFlightVisual | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const heightmapRef = useRef<HTMLCanvasElement | null>(null)

  const toPixel = (width: number, height: number, xM: number, yM: number) => toPixelWithScale(width, height, xM, yM, scaleMetersPerPixel)

  // Regenerate the terrain heightmap texture only when the terrain, theme, or zoom changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const width = container.clientWidth || 600
    const height = HEIGHT
    const gridW = HEIGHTMAP_GRID_W
    const gridH = Math.max(1, Math.round(gridW * (height / width)))

    let off = heightmapRef.current
    if (!off) {
      off = document.createElement('canvas')
      heightmapRef.current = off
    }
    off.width = gridW
    off.height = gridH
    const octx = off.getContext('2d')
    if (!octx) return

    const img = octx.createImageData(gridW, gridH)
    const heights = new Float32Array(gridW * gridH)
    const metersPerCellX = (width / gridW) * scaleMetersPerPixel
    const metersPerCellY = (height / gridH) * scaleMetersPerPixel
    let minH = Number.POSITIVE_INFINITY
    let maxH = Number.NEGATIVE_INFINITY
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const xM = (gx - gridW / 2 + 0.5) * metersPerCellX
        const yM = -(gy - gridH / 2 + 0.5) * metersPerCellY
        const h = terrain(xM, yM)
        heights[gy * gridW + gx] = h
        if (h < minH) minH = h
        if (h > maxH) maxH = h
      }
    }
    const range = Math.max(maxH - minH, 1)
    const low = hexToRgb(theme.ground)
    const high = hexToRgb(theme.groundHigh)
    for (let i = 0; i < heights.length; i++) {
      const frac = (heights[i] - minH) / range
      const c = lerpColor(low, high, frac)
      img.data[i * 4] = c.r
      img.data[i * 4 + 1] = c.g
      img.data[i * 4 + 2] = c.b
      img.data[i * 4 + 3] = 255
    }
    octx.putImageData(img, 0, 0)
  }, [terrain, theme, scaleMetersPerPixel])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const width = container.clientWidth
    const height = HEIGHT
    const ctx = setupHiDPICanvas(canvas, width, height)

    const centerX = width / 2
    const centerY = height / 2

    const heightmap = heightmapRef.current
    if (heightmap) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(heightmap, 0, 0, heightmap.width, heightmap.height, 0, 0, width, height)
    } else {
      ctx.fillStyle = theme.ground
      ctx.fillRect(0, 0, width, height)
    }
    // subtle vignette so markers/paths stay legible over busy terrain
    ctx.fillStyle = 'rgba(3,7,18,0.28)'
    ctx.fillRect(0, 0, width, height)

    // range rings
    const niceStep = pickRingStep(scaleMetersPerPixel, Math.min(width, height) / 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.fillStyle = 'rgba(226,232,240,0.55)'
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
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, height)
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
    ctx.fillStyle = 'rgba(226,232,240,0.8)'
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
    ctx.fillStyle = '#e0f2fe'
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

    const drawTrail = (samples: FlightSample[], upToTime: number, color: string, lineWidth: number) => {
      if (samples.length === 0) return
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      let started = false
      for (const s of samples) {
        if (s.t > upToTime) break
        const { px, py } = toPixelWithScale(width, height, s.xEast, s.xNorth, scaleMetersPerPixel)
        if (!started) {
          ctx.moveTo(px, py)
          started = true
        } else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    const drawImpactMarker = (px: number, py: number, hit: boolean) => {
      ctx.fillStyle = hit ? '#4ade80' : '#f87171'
      ctx.beginPath()
      ctx.arc(px, py, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = 'bold 10px sans-serif'
      ctx.fillStyle = '#f8fafc'
      ctx.fillText(hit ? 'HIT' : 'MISS', px + 11, py + 3)
    }

    const drawMarker = (px: number, py: number, alt: number, color: string) => {
      const r = 4 + Math.min(alt / 500, 9)
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    if (flight && flight.samples.length > 0) {
      const { px: tpx, py: tpy } = toPixelWithScale(width, height, flight.targetX, flight.targetY, scaleMetersPerPixel)
      ctx.strokeStyle = 'rgba(251,146,60,0.55)'
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

      drawTrail(flight.samples, flight.time, '#fbbf24', 2.5)
      drawMarker(rpx, rpy, curAlt, '#fb923c')
      if (flight.landed) drawImpactMarker(rpx, rpy, flight.hit)
    }

    if (mirv) {
      // shared boost trail
      drawTrail(mirv.boostSamples, Math.min(mirv.time, mirv.releaseTime), '#f8fafc', 2.5)

      for (const warhead of mirv.warheads) {
        const { px: tpx, py: tpy } = toPixelWithScale(width, height, warhead.targetX, warhead.targetY, scaleMetersPerPixel)
        ctx.strokeStyle = `${warhead.color}88`
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        const releasePt = mirv.boostSamples[mirv.boostSamples.length - 1]
        if (releasePt) {
          const { px: rx0, py: ry0 } = toPixelWithScale(width, height, releasePt.xEast, releasePt.xNorth, scaleMetersPerPixel)
          ctx.beginPath()
          ctx.moveTo(rx0, ry0)
          ctx.lineTo(tpx, tpy)
          ctx.stroke()
        }
        ctx.setLineDash([])

        if (mirv.time <= mirv.releaseTime || warhead.samples.length === 0) continue
        drawTrail(warhead.samples, mirv.time, warhead.color, 2.5)

        const { index, frac } = findTimeIndex(warhead.samples, mirv.time)
        const next = warhead.samples[Math.min(index + 1, warhead.samples.length - 1)]
        const curX = lerp(warhead.samples[index].xEast, next.xEast, frac)
        const curY = lerp(warhead.samples[index].xNorth, next.xNorth, frac)
        const curAlt = lerp(warhead.samples[index].altitude, next.altitude, frac)
        const { px: wpx, py: wpy } = toPixelWithScale(width, height, curX, curY, scaleMetersPerPixel)
        drawMarker(wpx, wpy, curAlt, warhead.color)

        const landed = mirv.time >= warhead.samples[warhead.samples.length - 1].t
        if (landed) drawImpactMarker(wpx, wpy, warhead.hit)
      }
    }
  }, [targets, selectedId, scaleMetersPerPixel, flight, mirv, terrain, theme])

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
