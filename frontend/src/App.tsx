import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CommandBar } from '@/components/CommandBar'
import { SpliceTray } from '@/components/SpliceTray'
import { BentoCanvas } from '@/components/BentoCanvas'
import { InspectorRail } from '@/components/InspectorRail'
import { Timeline } from '@/components/Timeline'
import { ProbeField } from '@/particles/ProbeField'
import { SpliceGesture } from '@/particles/SpliceGesture'
import { SceneRoot } from '@/components/SceneRoot'
import { FieldStateGate } from '@/components/FieldStateGate'
import { SessionHistory } from '@/components/SessionHistory'
import { useSession } from '@/state/session'

export function App() {
  return (
    <SceneRoot>
      <FieldStateGate />
      <div
        className="grid h-screen w-screen text-[var(--color-fg)] relative"
        style={{
          gridTemplateRows: '52px 1fr 64px',
          gridTemplateColumns: '240px 1fr 320px',
          gridTemplateAreas: `
            "cmd    cmd    cmd"
            "tray   canvas inspector"
            "tline  tline  tline"
          `,
        }}
      >
        {/* Bento backdrop: cool + warm radial blooms so glass has something
            nontrivial to refract. Sits below everything else. */}
        <div className="gb-canvas-backdrop" aria-hidden="true" />

        <div style={{ gridArea: 'cmd' }} className="gb-cmd-host">
          <CommandBar />
        </div>
        <div style={{ gridArea: 'tray' }} className="gb-tray-host overflow-y-auto no-scrollbar">
          <SpliceTray />
        </div>
        <div style={{ gridArea: 'canvas' }} className="relative overflow-hidden">
          {/* Backdrop: live adversarial-prober particles, Backboard-orchestrated when wired. */}
          <ProbeField />
          {/* Gesture overlay: drag-to-splice rectangle, sits between particles and panels. */}
          <SpliceGesture />
          {/* Foreground: dashboard panels, above the field via gb-bento-canvas z-index. */}
          <BentoCanvas />
        </div>
        <div style={{ gridArea: 'inspector' }} className="gb-inspector-host overflow-y-auto no-scrollbar">
          <InspectorRail />
        </div>
        <div style={{ gridArea: 'tline' }} className="gb-tline-host">
          <Timeline />
        </div>
      </div>

      <SessionHistory />
      <ResumeToast />
    </SceneRoot>
  )
}

function ResumeToast() {
  const { info, toastDismissed, dismissToast } = useSession()

  const message = useMemo(() => {
    if (!info || !info.available) return null
    if (info.resumed && info.summary) {
      const { accepted, rejected, param_changes, last_session_started } = info.summary
      const when = last_session_started
        ? new Date(last_session_started * 1000).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : 'previous session'
      return `Resumed audit from ${when}. ${accepted} accepted · ${rejected} rejected · ${param_changes} param changes.`
    }
    return 'New audit session started.'
  }, [info])

  useEffect(() => {
    if (!message || toastDismissed) return
    const t = setTimeout(dismissToast, 6000)
    return () => clearTimeout(t)
  }, [message, toastDismissed, dismissToast])

  const visible = !!message && !toastDismissed

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-[60px] left-1/2 -translate-x-1/2 z-40
                     rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)]
                     px-3 py-2 text-[12px] text-[var(--color-fg)] shadow-lg
                     flex items-center gap-3"
          role="status"
        >
          <span>{message}</span>
          <button
            onClick={dismissToast}
            className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
