import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { tokens } from '@/lib/tokens'

export type CaptionFraming = 'accept' | 'reject' | 'committed'

export interface CaptionProps {
  text: string
  framing: CaptionFraming
  className?: string
  /** When true, animate words in via stagger. Set false for static use inside
   *  hover cards where the parent owns its own enter animation. */
  animate?: boolean
}

/**
 * Consequence caption surface. Locks the second-person voice rules across
 * Inspector, ProbeCaptionCard, TimelineNode hover. Forbidden words ("might",
 * "may", "we believe", "approximately") are caller-checked at fixture time.
 */
export function Caption({ text, framing, className, animate = true }: CaptionProps) {
  const words = text.split(/(\s+)/)

  return (
    <p
      data-framing={framing}
      className={cn(
        'gb-caption',
        'text-[length:var(--gb-text-body)]',
        'text-[var(--color-fg)]',
        className,
      )}
      style={{
        lineHeight: 'var(--gb-caption-line-h)',
        maxWidth: 'var(--gb-caption-max-w)',
      }}
    >
      {animate ? words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: (i / 2) * tokens.staggerCaptionSec,
            duration: tokens.durQuickSec,
            ease: 'easeOut',
          }}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {w}
        </motion.span>
      )) : text}
    </p>
  )
}
