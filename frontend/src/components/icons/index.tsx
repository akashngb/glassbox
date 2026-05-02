import type { SplicePrimitive } from '@/types/analysis'

interface GlyphProps {
  preview?: boolean
  size?: number
  className?: string
}

const SIZE = 24
const STROKE_WIDTH = 1.5

const baseSvgProps = {
  viewBox: `0 0 ${SIZE} ${SIZE}`,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: STROKE_WIDTH,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Filled circle with strikethrough; preview = strike peels away. */
const UNLEARN_IDLE = 'M 4 12 L 20 12 M 12 6 L 12 18'
const UNLEARN_PREV = 'M 4 8  L 20 16 M 12 6 L 12 18'

/** Balance scale; preview = beam tilts. */
const REWEIGHT_IDLE = 'M 4 9 L 20 9 M 7 9 L 7 17 M 17 9 L 17 17 M 12 9 L 12 5'
const REWEIGHT_PREV = 'M 4 7 L 20 11 M 7 7 L 7 17 M 17 11 L 17 17 M 12 9 L 12 5'

/** Three-dot triangle; preview = fans out. */
const SMOTE_IDLE = 'M 12 7 L 12 7 M 8  15 L 8  15 M 16 15 L 16 15'
const SMOTE_PREV = 'M 12 5 L 12 5 M 6  17 L 6  17 M 18 17 L 18 17'

/** Stacked rectangles split by horizontal line; preview = line moves up. */
const THRESHOLD_IDLE = 'M 4 12 L 20 12 M 7 7 L 17 7 M 7 17 L 17 17'
const THRESHOLD_PREV = 'M 4 9  L 20 9  M 7 5 L 17 5 M 7 17 L 17 17'

/** Square with constraint brackets; preview = brackets close inward. */
const FAIRLEARN_IDLE = 'M 8 6 L 6 6 L 6 18 L 8 18 M 16 6 L 18 6 L 18 18 L 16 18 M 9 9 L 15 9 L 15 15 L 9 15 Z'
const FAIRLEARN_PREV = 'M 9 6 L 7 6 L 7 18 L 9 18 M 15 6 L 17 6 L 17 18 L 15 18 M 9 9 L 15 9 L 15 15 L 9 15 Z'

const PATHS: Record<SplicePrimitive, [idle: string, preview: string]> = {
  unlearn:   [UNLEARN_IDLE,  UNLEARN_PREV],
  reweight:  [REWEIGHT_IDLE, REWEIGHT_PREV],
  smote:     [SMOTE_IDLE,    SMOTE_PREV],
  threshold: [THRESHOLD_IDLE, THRESHOLD_PREV],
  fairlearn: [FAIRLEARN_IDLE, FAIRLEARN_PREV],
}

export interface FamilyGlyphProps extends GlyphProps {
  family: SplicePrimitive
}

export function FamilyGlyph({ family, preview = false, size = SIZE, className }: FamilyGlyphProps) {
  const pair = PATHS[family]
  if (!pair) return null
  const target = preview ? pair[1] : pair[0]

  return (
    <svg width={size} height={size} className={className} {...baseSvgProps}>
      <path
        d={target}
        style={{ transition: 'd 240ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    </svg>
  )
}
