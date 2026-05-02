import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { tokens } from '@/lib/tokens'
import type { TimelineNode as TimelineNodeData } from '@/state/glassbox'

export interface TimelineNodeProps {
  node: TimelineNodeData
  isHead: boolean
  isPending?: boolean
  onScrub?: (id: string) => void
}

export function TimelineNode({ node, isHead, isPending, onScrub }: TimelineNodeProps) {
  const [hover, setHover] = useState(false)
  const isBaseline = node.parentId === null
  const dotColor = isPending
    ? 'var(--color-pending)'
    : isHead
      ? 'var(--color-accent)'
      : isBaseline
        ? 'var(--color-baseline)'
        : 'var(--color-fg-muted)'

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.button
        type="button"
        disabled={isHead || isPending}
        onClick={() => onScrub?.(node.id)}
        className={cn(
          'rounded-full',
          !isHead && !isPending && 'cursor-pointer',
        )}
        style={{
          width: 'var(--gb-timeline-node-d)',
          height: 'var(--gb-timeline-node-d)',
          background: isPending ? 'var(--color-bg)' : dotColor,
          border: isPending ? `2px solid ${dotColor}` : 'none',
          boxShadow: isHead ? `0 0 0 6px var(--color-accent-soft)` : 'none',
        }}
        whileHover={!isHead && !isPending ? { scale: 1.2 } : undefined}
        transition={tokens.springSnap}
      />
      <div
        className="gb-num text-[length:var(--gb-text-micro)] whitespace-nowrap"
        style={{ color: dotColor }}
      >
        {isPending ? 'pending' : node.splice?.label.slice(0, 18) ?? 'baseline'}
      </div>

      <AnimatePresence>
        {hover && !isHead && !isPending && !isBaseline && node.caption && (
          <motion.div
            data-intensity="raised"
            className={cn(
              'gb-glass absolute z-10 left-1/2 -translate-x-1/2 bottom-full mb-2',
              'rounded-[var(--radius-tray)]',
              'px-3 py-2 min-w-[220px]',
            )}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: tokens.durQuickSec }}
          >
            <div className="text-[length:var(--gb-text-meta)] font-bold leading-tight">
              {node.splice?.label}
            </div>
            <div className="mt-1 text-[length:var(--gb-text-meta)] text-[var(--color-fg-muted)]">
              {node.caption}
            </div>
            <div className="gb-num mt-1 text-[length:var(--gb-text-micro)] text-[var(--color-fg-subtle)]">
              {new Date(node.acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
