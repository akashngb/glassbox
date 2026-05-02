import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { tokens } from '@/lib/tokens'
import { FamilyGlyph } from './icons'
import type { Splice, SplicePrimitive } from '@/types/analysis'

const PRIMITIVE_LABEL: Record<SplicePrimitive, string> = {
  unlearn:   'unlearn',
  reweight:  'reweight',
  smote:     'augment',
  threshold: 'threshold',
  fairlearn: 'constraint',
}

const PRIMITIVE_COLOR_VAR: Record<SplicePrimitive, string> = {
  unlearn:   '--gb-family-unlearn',
  reweight:  '--gb-family-reweight',
  smote:     '--gb-family-smote',
  threshold: '--gb-family-threshold',
  fairlearn: '--gb-family-fairlearn',
}

export interface SpliceTileProps {
  splice: Splice
  isPending: boolean
  onStage: () => void
}

/**
 * Single transformation card. Drag handle is hover-revealed; glyph morphs
 * idle → preview on hover so the user reads "this splice has a verb."
 */
export function SpliceTile({ splice, isPending, onStage }: SpliceTileProps) {
  const [hover, setHover] = useState(false)
  const colorVar = PRIMITIVE_COLOR_VAR[splice.primitive]
  const heavy = splice.magnitude > 0.7

  return (
    <motion.button
      type="button"
      onClick={onStage}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={{ scale: 0.985 }}
      animate={{ y: hover ? -1 : 0 }}
      transition={tokens.springChrome}
      data-intensity="raised"
      data-splice-id={splice.id}
      data-splice-primitive={splice.primitive}
      className={cn(
        'gb-glass group relative w-full text-left overflow-hidden',
        'rounded-[var(--radius-tray)]',
        'px-3 py-2.5 transition-colors',
        isPending && 'border-[var(--color-pending)]',
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className="shrink-0 mt-0.5"
          style={{ color: hover ? `var(${colorVar})` : 'var(--color-fg-muted)', transition: 'color 180ms' }}
        >
          <FamilyGlyph family={splice.primitive} preview={hover} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[length:var(--gb-text-body)] leading-tight truncate">
            {splice.label}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <MagnitudeBar value={splice.magnitude} heavy={heavy} />
        <div className="gb-num text-[length:var(--gb-text-micro)] text-[var(--color-fg-subtle)] tabular-nums">
          {Math.round(splice.magnitude * 100)}%
        </div>
        <div
          className="gb-num text-[length:var(--gb-text-micro)] uppercase tracking-[0.14em]"
          style={{ color: `var(${colorVar})` }}
        >
          {PRIMITIVE_LABEL[splice.primitive]}
        </div>
      </div>
    </motion.button>
  )
}

function MagnitudeBar({ value, heavy }: { value: number; heavy: boolean }) {
  return (
    <div className="h-px flex-1 bg-[var(--color-border)] overflow-hidden">
      <motion.div
        className="h-full"
        style={{ background: heavy ? 'var(--color-accent-strong)' : 'var(--color-accent)' }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={tokens.springChrome}
      />
    </div>
  )
}
