/**
 * Wave — the visual primitive every panel renders.
 *
 * Two layered SVG paths:
 *   - baseline path (solid, muted color)
 *   - ghost path (overlay, accent color, drawn via pathLength when pending)
 *
 * The morph happens via path d-interpolation when ghost arrives.
 */
import { motion } from 'motion/react'

export interface WaveProps {
  baseline: number[]    // y values 0..1
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
  return values
    .map((v, i) => {
      const x = i * step
      const y = h * (1 - clamp(v, 0, 1))
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
