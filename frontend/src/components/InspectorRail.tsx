import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { tokens } from '@/lib/tokens'
import {
  pywebview,
  type AcceptedSpliceEntry,
  type ModelIdentity,
  type RetuneReport,
} from '@/lib/pywebview'
import { Caption } from './Caption'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'

export function InspectorRail() {
  const { pending, accept, reject, selection, scrub, timeline } = useAnalysis()
  const [identity, setIdentity] = useState<ModelIdentity | null>(null)
  const [fixMessage, setFixMessage] = useState<string | null>(null)
  const [retune, setRetune] = useState<RetuneReport | null>(null)
  const [accepted, setAccepted] = useState<AcceptedSpliceEntry[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      pywebview.modelIdentity(),
      pywebview.fixMessage(),
      pywebview.retune(),
      pywebview.acceptedSplices(),
    ]).then(([id, msg, rt, acc]) => {
      if (cancelled) return
      setIdentity(id)
      setFixMessage(msg)
      setRetune(rt)
      setAccepted(acc)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function refresh() {
      pywebview.acceptedSplices().then(setAccepted)
    }
    window.addEventListener('glassbox:accepted-changed', refresh)
    return () => window.removeEventListener('glassbox:accepted-changed', refresh)
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
              <div className="font-display italic text-[18px] leading-none text-[var(--color-fg-muted)]">
                pending splice
              </div>
              <div className="text-[15px] font-semibold mt-1 text-[var(--color-fg)]">
                {pending.splice.label}
              </div>
            </div>

            <div className="max-w-[480px]">
              <Caption text={pending.caption} framing="accept" />
            </div>

            <RetunePreview report={retune} primitive={pending.splice.primitive} />

            <div className="mt-auto flex gap-2">
              <Button onClick={accept} size="lg" variant="default" className="flex-1 rounded-full px-5">
                Accept
              </Button>
              <Button onClick={reject} size="lg" variant="outline" className="flex-1 rounded-full px-5">
                Reject
              </Button>
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
            <div className="max-w-[480px]">
              <Caption
                text="Drag a region of the field, or pick a transformation from the tray. Each splice previews here before commit."
                framing="accept"
                animate={false}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 text-[length:var(--gb-text-body)] text-[var(--color-fg-subtle)] flex-1"
          >
            {identity?.loaded && (
              <Pill>
                COMPAS recidivism · {identity.n_samples?.toLocaleString()} samples · acc {identity.accuracy?.toFixed(3)} · {identity.n_flags} bias flags
              </Pill>
            )}
            <div className="max-w-[480px]">
              <Caption
                text="No splice staged. Drag a region of the probe field, or pick a transformation from the tray to inspect a remedy."
                framing="accept"
                animate={false}
              />
            </div>
            <FixMessageCard text={fixMessage} />
          </motion.div>
        )}
      </AnimatePresence>

      <AcceptedFooter entries={accepted} />
    </div>
  )
}

function FixMessageCard({ text }: { text: string | null }) {
  if (!text) return null
  const trimmed = text.trim()
  const headline = trimmed.split('\n').find((l) => l.trim().length > 0) ?? ''
  const cleanHeadline = headline.replace(/^#+\s*/, '')
  const body = trimmed.split('\n').slice(1).join('\n').trim()
  const preview = body.length > 320 ? body.slice(0, 320).trimEnd() + '…' : body
  return (
    <div className="mt-2 rounded-[10px] border border-[var(--color-border)] bg-white/[0.02] p-3 max-w-[480px]">
      <div className="gb-unit-label mb-1.5">fix_message.md</div>
      {cleanHeadline && (
        <div className="font-display italic text-[16px] leading-tight text-[var(--color-fg)] mb-2">
          {cleanHeadline}
        </div>
      )}
      <div className="text-[length:var(--gb-text-body)] leading-[1.45] text-[var(--color-fg-muted)] whitespace-pre-wrap">
        {preview}
      </div>
    </div>
  )
}

function RetunePreview({ report, primitive }: { report: RetuneReport | null; primitive: string }) {
  if (!report) return null
  const primitiveTouchedKeys: Record<string, string[]> = {
    unlearn:   ['CANDIDATE_SCORE', 'MAX_UNLEARN_PCT'],
    reweight:  ['class_weight'],
    smote:     ['class_weight'],
    threshold: ['target_rate'],
    fairlearn: ['constraint'],
  }
  const keys = primitiveTouchedKeys[primitive] ?? []
  const entries = keys
    .map((k) => [k, report.predicted_params[k]] as const)
    .filter(([, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return null
  return (
    <div className="rounded-[10px] border border-[var(--color-border)] bg-white/[0.02] p-3 max-w-[480px]">
      <div className="gb-unit-label mb-1.5">predicted retune</div>
      <ul className="space-y-1">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-3 text-[length:var(--gb-text-body)]">
            <span className="text-[var(--color-fg-muted)] font-mono">{k}</span>
            <span className="gb-num text-[var(--color-fg)]">{String(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AcceptedFooter({ entries }: { entries: AcceptedSpliceEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="border-t border-[var(--color-border)] pt-3 mt-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="gb-unit-label">accepted ({entries.length})</div>
        <div className="text-[length:var(--gb-text-micro)] text-[var(--color-fg-subtle)] font-mono">
          glassbox_accepted.py
        </div>
      </div>
      <ul className="space-y-1">
        {(() => {
          const offset = Math.max(0, entries.length - 4)
          return entries.slice(-4).map((entry, i) => (
            <li
              key={`${entry.id}-${offset + i}`}
              className="text-[length:var(--gb-text-meta)] text-[var(--color-fg-muted)] truncate"
            >
              <span className="text-[var(--color-fg-subtle)]">_splice_{offset + i} </span>
              {entry.label}
            </li>
          ))
        })()}
      </ul>
    </div>
  )
}
