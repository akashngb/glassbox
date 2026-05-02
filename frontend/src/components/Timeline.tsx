import { motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'

export function Timeline() {
  const { timeline, pending } = useAnalysis()

  return (
    <div className="flex h-full items-center gap-4 px-4">
      <div className="gb-unit-label shrink-0">Timeline</div>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {timeline.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2"
          >
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[var(--color-fg-muted)]" />
              <div className="gb-num text-[10px] text-[var(--color-fg-subtle)] whitespace-nowrap">
                {node.splice?.label.slice(0, 18) ?? 'baseline'}
              </div>
            </div>
            {i < timeline.length - 1 && (
              <div className="w-6 h-px bg-[var(--color-border)]" />
            )}
          </motion.div>
        ))}

        {pending && (
          <>
            {timeline.length > 0 && <div className="w-6 h-px bg-[var(--color-border)] border-dashed" />}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-3 h-3 rounded-full border-2 border-[var(--color-pending)] bg-[var(--color-bg)]" />
              <div className="gb-num text-[10px] text-[var(--color-pending)] whitespace-nowrap">
                pending
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
