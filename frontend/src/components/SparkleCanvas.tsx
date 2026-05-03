import { useEffect, useRef } from 'react'

const GRID_SPACING = 22
const DOT_RADIUS = 1
const DOT_BASE_ALPHA = 0.18
const SPARKLE_ALPHA = 0.95
const SPARKLE_LIFETIME_MS = 1400
const SPARKLES_PER_SECOND = 14

type Sparkle = {
  col: number
  row: number
  startedAt: number
  duration: number
}

export function SparkleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = window.devicePixelRatio || 1
    let cols = 0
    let rows = 0
    const sparkles: Sparkle[] = []
    let lastSpawnAt = performance.now()
    let raf = 0

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / GRID_SPACING) + 1
      rows = Math.ceil(h / GRID_SPACING) + 1
    }

    const spawnSparkle = (now: number) => {
      sparkles.push({
        col: Math.floor(Math.random() * cols),
        row: Math.floor(Math.random() * rows),
        startedAt: now,
        duration: SPARKLE_LIFETIME_MS * (0.7 + Math.random() * 0.6),
      })
    }

    const draw = (now: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      // Offset grid so dots sit on a half-step (looks more centered).
      const offsetX = (w - (cols - 1) * GRID_SPACING) / 2
      const offsetY = (h - (rows - 1) * GRID_SPACING) / 2

      // Base grid pass.
      ctx.fillStyle = `rgba(232, 234, 238, ${DOT_BASE_ALPHA})`
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offsetX + c * GRID_SPACING
          const y = offsetY + r * GRID_SPACING
          ctx.beginPath()
          ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Spawn new sparkles at a steady rate (Poisson-ish).
      const elapsedSinceSpawn = now - lastSpawnAt
      const expectedSpawns = (elapsedSinceSpawn / 1000) * SPARKLES_PER_SECOND
      let toSpawn = Math.floor(expectedSpawns)
      if (Math.random() < expectedSpawns - toSpawn) toSpawn += 1
      for (let i = 0; i < toSpawn; i++) spawnSparkle(now)
      if (toSpawn > 0) lastSpawnAt = now

      // Sparkle pass — additive overlay on top of base dots.
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i]
        const t = (now - s.startedAt) / s.duration
        if (t >= 1) {
          sparkles.splice(i, 1)
          continue
        }
        // Triangular envelope, eased — quick brighten, slower fade.
        const envelope = t < 0.25
          ? t / 0.25
          : 1 - (t - 0.25) / 0.75
        const eased = envelope * envelope * (3 - 2 * envelope)
        const alpha = DOT_BASE_ALPHA + eased * (SPARKLE_ALPHA - DOT_BASE_ALPHA)
        const radius = DOT_RADIUS + eased * 1.4
        const x = offsetX + s.col * GRID_SPACING
        const y = offsetY + s.row * GRID_SPACING

        // Soft halo.
        const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 4)
        halo.addColorStop(0, `rgba(232, 234, 238, ${eased * 0.35})`)
        halo.addColorStop(1, 'rgba(232, 234, 238, 0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, radius * 4, 0, Math.PI * 2)
        ctx.fill()

        // Core dot.
        ctx.fillStyle = `rgba(232, 234, 238, ${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      style={{ background: 'var(--color-bg)', pointerEvents: 'none' }}
    />
  )
}
