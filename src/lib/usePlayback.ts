import { useEffect, useRef, useState } from 'react'

export function usePlayback(duration: number) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)

  useEffect(() => {
    setTime(0)
    setPlaying(false)
  }, [duration])

  useEffect(() => {
    if (!playing) {
      lastRef.current = null
      return
    }
    const tick = (now: number) => {
      if (lastRef.current !== null) {
        const dt = (now - lastRef.current) / 1000
        setTime((prev) => {
          const next = prev + dt * speed
          if (next >= duration) {
            setPlaying(false)
            return duration
          }
          return next
        })
      }
      lastRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, duration])

  const play = () => {
    if (time >= duration) setTime(0)
    setPlaying(true)
  }
  const pause = () => setPlaying(false)
  const reset = () => {
    setTime(0)
    setPlaying(false)
  }

  return { time, setTime, playing, play, pause, reset, speed, setSpeed }
}
