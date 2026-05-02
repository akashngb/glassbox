import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { tokens } from '@/lib/tokens'

export type CaptionSeverity = 'high' | 'medium' | 'low'

export interface ProbeCaption {
  id: string
  text: string
  severity: CaptionSeverity
  /** Override the default lifespan (--gb-caption-lifespan). */
  lifespanMs?: number
}

const SEVERITY_BORDER: Record<CaptionSeverity, string> = {
  high:   'var(--probe-detected)',
  medium: 'var(--color-warn)',
  low:    'var(--probe-evaluating)',
}

export interface ProbeCaptionCardProps {
  caption: ProbeCaption
  className?: string
}

/**
 * Ambient caption that surfaces when a probe flags. Auto-dismisses; no close
 * affordance. Stacks bottom-left of the canvas; max 3 visible (parent caps).
 */
export function ProbeCaptionCard({ caption, className }: ProbeCaptionCardProps) {
  return (
    <motion.div
      data-intensity="raised"
      className={cn(
        'gb-glass relative overflow-hidden',
        'rounded-[var(--radius-tray)]',
        'px-[14px] py-3',
        'min-w-[280px]',
        className,
      )}
      style={{
        maxWidth: 'var(--gb-caption-max-w)',
        borderLeftColor: SEVERITY_BORDER[caption.severity],
        borderLeftWidth: 1,
        borderLeftStyle: 'solid',
      }}
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -8, opacity: 0 }}
      transition={{ duration: tokens.durBaseSec, ease: [0.16, 1, 0.3, 1] }}
    >
      <p
        className="text-[length:var(--gb-text-body)] text-[var(--color-fg)]"
        style={{
          lineHeight: 'var(--gb-caption-line-h)',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
          overflow: 'hidden',
        }}
      >
        {caption.text}
      </p>
    </motion.div>
  )
}
