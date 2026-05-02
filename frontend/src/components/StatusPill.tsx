import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export type ProbeFieldStatus = 'baseline' | 'detected' | 'spliced' | 'settled' | 'drifting'

const STATUS_COLOR: Record<ProbeFieldStatus, string> = {
  baseline:  'var(--probe-baseline)',
  detected:  'var(--probe-detected)',
  spliced:   'var(--probe-spliced)',
  settled:   'var(--color-good)',
  drifting:  'var(--color-warn)',
}

const STATUS_LABEL: Record<ProbeFieldStatus, string> = {
  baseline:  'baseline',
  detected:  'detected',
  spliced:   'spliced',
  settled:   'settled',
  drifting:  'drifting',
}

export interface StatusPillProps {
  state: ProbeFieldStatus
  count?: number
  className?: string
}

/**
 * The probe-state badge. Color comes from probe + semantic tokens; motion
 * grammar is per-state (detected pulses, drifting nudges, others static).
 */
export function StatusPill({ state, count, className }: StatusPillProps) {
  const isDetected = state === 'detected'
  const isDrifting = state === 'drifting'

  return (
    <motion.span
      className={cn('gb-pill', className)}
      style={{ color: STATUS_COLOR[state] }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={
        isDrifting
          ? { opacity: 1, scale: 1, x: [-1, 1, 0] }
          : { opacity: 1, scale: 1 }
      }
      transition={
        isDrifting
          ? { duration: 0.6, repeat: Infinity, repeatDelay: 4 }
          : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
      }
    >
      <motion.span
        className="gb-pill-dot"
        animate={isDetected ? { opacity: [1, 0.65, 1] } : { opacity: 1 }}
        transition={
          isDetected
            ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0 }
        }
      />
      <span className="text-[var(--color-fg)]">{STATUS_LABEL[state]}</span>
      {count !== undefined && (
        <span className="gb-num text-[10px] text-[var(--color-fg-muted)]">{count}</span>
      )}
    </motion.span>
  )
}
