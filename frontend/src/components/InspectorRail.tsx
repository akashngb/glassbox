import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { tokens } from '@/lib/tokens'
import { pywebview, type ModelIdentity } from '@/lib/pywebview'
import { Caption } from './Caption'
import { LiquidButton, MetalButton } from '@/components/ui/liquid-glass-button'

export function InspectorRail() {
  const { pending, accept, reject, selection, scrub, timeline } = useAnalysis()
  const [identity, setIdentity] = useState<ModelIdentity | null>(null)

  useEffect(() => {
    let cancelled = false
    pywebview.modelIdentity().then((id) => { if (!cancelled) setIdentity(id) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && pending && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        accept()
        return
      }
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      if (timeline.length <= 1) return
      e.preventDefault()
      scrub(timeline[timeline.length - 2].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scrub, timeline, pending, accept])

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <div className="gb-unit-label">Inspector</div>

      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div
            key={pending.splice.id}
            initial={{ x: 'var(--slide-inspector)', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 'var(--slide-inspector)', opacity: 0 }}
            transition={tokens.springSoft}
            className="flex flex-col gap-4 flex-1"
          >
            <div>
              <div className="gb-unit-label" style={{ color: 'var(--color-pending)' }}>
                pending splice
              </div>
              <div className="text-[15px] font-bold mt-1">
                {pending.splice.label}
              </div>
            </div>

            <Caption text={pending.caption} framing="accept" />

            <div className="mt-auto flex gap-2">
              <LiquidButton onClick={accept} size="lg" className="flex-1">
                Accept
              </LiquidButton>
              <MetalButton onClick={reject} className="flex-1">
                Reject
              </MetalButton>
            </div>
            <div className="gb-unit-label flex items-center gap-3 text-[var(--color-fg-subtle)]">
              <span>⌘Z scrub back</span>
              <span>⏎ accept</span>
              <span>esc reject</span>
            </div>
          </motion.div>
        ) : selection ? (
          <motion.div
            key={selection}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 text-[length:var(--gb-text-body)] text-[var(--color-fg-muted)]"
          >
            <div className="gb-unit-label">selected · {selection}</div>
            <Caption
              text="Drag a region of the field, or pick a transformation from the tray. Each splice previews here before commit."
              framing="accept"
              animate={false}
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 text-[length:var(--gb-text-body)] text-[var(--color-fg-subtle)]"
          >
            {identity?.loaded && (
              <div className="flex flex-col gap-1 pb-3 border-b border-[var(--color-border)]">
                <div className="gb-unit-label" style={{ color: 'var(--color-fg-muted)' }}>
                  loaded model
                </div>
                <div className="text-[13px] text-[var(--color-fg)] font-bold">
                  COMPAS recidivism
                </div>
                <div className="gb-num text-[11px] text-[var(--color-fg-muted)]">
                  {identity.n_samples?.toLocaleString()} samples · acc {identity.accuracy?.toFixed(3)} · {identity.n_flags} bias flags
                </div>
              </div>
            )}
            <Caption
              text="No splice staged. Drag a region of the probe field, or pick a transformation from the tray to inspect a remedy."
              framing="accept"
              animate={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
