import { motion, AnimatePresence } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { tokens } from '@/lib/tokens'
import { TimelineNode } from './TimelineNode'
import type { TimelineNode as TimelineNodeData } from '@/state/glassbox'

export function Timeline() {
  const { timeline, pending, scrub } = useAnalysis()
  const headIdx = timeline.length - 1

  const pendingPlaceholder: TimelineNodeData | null = pending
    ? {
        id: '__pending__',
        parentId: timeline[headIdx]?.id ?? null,
        splice: pending.splice,
        analysis: pending.ghost,
        caption: pending.caption,
        acceptedAt: Date.now(),
      }
    : null

  return (
    <div className="flex h-full items-center gap-4 px-4">
      <div className="gb-unit-label shrink-0">Timeline</div>
      <div className="flex flex-1 items-center gap-[var(--gb-timeline-gap)] overflow-x-auto no-scrollbar">
        <AnimatePresence initial={false}>
          {timeline.map((node, i) => (
            <motion.div
              key={node.id}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: tokens.durQuickSec }}
              className="flex items-center gap-[var(--gb-timeline-gap)]"
            >
              <TimelineNode
                node={node}
                isHead={i === headIdx && !pending}
                onScrub={scrub}
              />
              {(i < timeline.length - 1 || pendingPlaceholder) && (
                <div
                  className="bg-[var(--color-border)]"
                  style={{ width: 24, height: 'var(--gb-timeline-connector-h)' }}
                />
              )}
            </motion.div>
          ))}
          {pendingPlaceholder && (
            <motion.div
              key="__pending__"
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: tokens.durQuickSec, ease: [0.20, 0.80, 0.30, 1.05] }}
            >
              <TimelineNode
                node={pendingPlaceholder}
                isHead={false}
                isPending
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
