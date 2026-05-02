import { motion } from 'motion/react'

export interface WaveProps {
  baseline: number[]
  ghost?: number[] | null
  width?: number
  height?: number
}

export function Wave({ baseline, ghost, width = 320, height = 80 }: WaveProps) {
  const baseD = pointsToPath(baseline, width, height)
  const ghostD = ghost ? pointsToPath(ghost, width, height) : null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full h-[var(--wave-height,80px)]"
      aria-hidden="true"
    >
      <motion.path
        d={baseD}
        fill="none"
        stroke="var(--color-baseline)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ d: baseD }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      />
      {ghostD && (
        <motion.path
          d={ghostD}
          fill="none"
          stroke="var(--color-pending)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          exit={{ pathLength: 0, opacity: 0 }}
          transition={{ pathLength: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2 } }}
        />
      )}
    </svg>
  )
}

function pointsToPath(values: number[], w: number, h: number): string {
  if (values.length === 0) return `M 0 ${h / 2} L ${w} ${h / 2}`
  if (values.length === 1) return `M 0 ${h * (1 - values[0])} L ${w} ${h * (1 - values[0])}`

  const step = w / (values.length - 1)
  const pts = values.map((v, i) => ({ x: i * step, y: h * (1 - clamp(v, 0, 1)) }))

  const tension = 0.5
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
