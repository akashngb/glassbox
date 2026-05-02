import { AnimatePresence, motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'

export function InspectorRail() {
  const { pending, accept, reject, selection } = useAnalysis()

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <div className="gb-unit-label">Inspector</div>

      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div
            key={pending.splice.id}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4"
          >
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-pending)]">
                pending splice
              </div>
              <div className="text-[15px] font-bold mt-1">{pending.splice.label}</div>
            </div>

            <p className="text-[13px] leading-relaxed text-[var(--color-fg)]">
              {pending.caption}
            </p>

            <div className="mt-auto flex gap-2">
              <button
                onClick={accept}
                className="flex-1 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] px-3 py-2 text-[13px] font-bold hover:bg-[var(--color-accent-strong)] transition-colors"
              >
                Accept
              </button>
              <button
                onClick={reject}
                className="flex-1 rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)] px-3 py-2 text-[13px] hover:border-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
              >
                Reject
              </button>
            </div>
          </motion.div>
        ) : selection ? (
          <motion.div
            key={selection}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 text-[13px] text-[var(--color-fg-muted)]"
          >
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              selected · {selection}
            </div>
            <p>Drag a splice from the tray, or use the command bar above. Each splice previews here before commit.</p>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[13px] text-[var(--color-fg-subtle)]"
          >
            <p>No splice staged. Click a panel to inspect, or pick a transformation from the tray.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
