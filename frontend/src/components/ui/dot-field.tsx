import { useMemo, type CSSProperties } from 'react'

export interface DotFieldProps {
  className?: string
  cols?: number
  rows?: number
  stepX?: number
  stepY?: number
}

type Cell = {
  r: number
  c: number
  tier: 'dim' | 'mid' | 'bright'
  sparkle: boolean
  delay: number
  duration: number
}

export function DotField({
  className,
  cols = 26,
  rows = 32,
  stepX = 14,
  stepY = 14,
}: DotFieldProps) {
  const offsetX = 8
  const offsetY = 8
  const vbW = offsetX * 2 + (cols - 1) * stepX
  const vbH = offsetY * 2 + (rows - 1) * stepY

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = (r * 53 + c * 29) % 97
        const b = (r * 17 + c * 41 + 7) % 89
        const tier: Cell['tier'] =
          a % 23 === 0 ? 'bright' : a % 7 === 0 ? 'mid' : 'dim'
        const sparkle = tier !== 'dim' && b % 7 === 0
        const delay = (b / 89) * 6
        const duration = 3 + ((a * 13) % 50) / 12
        out.push({ r, c, tier, sparkle, delay, duration })
      }
    }
    return out
  }, [rows, cols])

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id="gb-dotFade" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="38%" stopColor="white" stopOpacity="0.95" />
          <stop offset="78%" stopColor="white" stopOpacity="0.18" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="gb-dotFadeMask">
          <rect width={vbW} height={vbH} fill="url(#gb-dotFade)" />
        </mask>
      </defs>
      <g mask="url(#gb-dotFadeMask)">
        {cells.map(({ r, c, tier, sparkle, delay, duration }) => {
          const radius = tier === 'bright' ? 1.6 : tier === 'mid' ? 1.1 : 0.7
          const baseOpacity =
            tier === 'bright' ? 1 : tier === 'mid' ? 0.6 : 0.32
          const peak = tier === 'bright' ? 1 : 0.9
          return (
            <circle
              key={`${r}-${c}`}
              cx={offsetX + c * stepX}
              cy={offsetY + r * stepY}
              r={radius}
              fill="white"
              opacity={baseOpacity}
              className={sparkle ? 'dot-sparkle' : undefined}
              style={
                sparkle
                  ? ({
                      ['--sparkle-base' as string]: baseOpacity,
                      ['--sparkle-peak' as string]: peak,
                      ['--sparkle-min' as string]: 0.04,
                      ['--sparkle-delay' as string]: `${delay.toFixed(2)}s`,
                      ['--sparkle-duration' as string]: `${duration.toFixed(2)}s`,
                    } as CSSProperties)
                  : undefined
              }
            />
          )
        })}
      </g>
    </svg>
  )
}
