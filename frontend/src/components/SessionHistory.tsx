import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { pywebview, type SessionEvent } from '@/lib/pywebview'
import { useSession } from '@/state/session'
import { cn } from '@/lib/cn'

type FilterKey = 'all' | 'accepted' | 'rejected' | 'params'

const FILTER_TO_TYPES: Record<FilterKey, string[] | null> = {
  all: null,
  accepted: ['diff_accepted'],
  rejected: ['diff_rejected'],
  params: ['param_changed'],
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'params', label: 'Params' },
]

export function SessionHistory() {
  const { historyOpen, setHistoryOpen, refreshVersion } = useSession()
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!historyOpen) return
    let cancelled = false
    setLoading(true)
    pywebview.sessionHistory(null, 200).then(rows => {
      if (cancelled) return
      setEvents(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [historyOpen, refreshVersion])

  const filtered = useMemo(() => {
    const types = FILTER_TO_TYPES[filter]
    const rows = types ? events.filter(e => types.includes(e.event_type)) : events
    return [...rows].reverse()
  }, [events, filter])

  return (
    <AnimatePresence>
      {historyOpen && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-[52px] right-0 bottom-[64px] w-[360px] z-30
                     bg-[var(--color-bg)] border-l border-[var(--color-border)]
                     flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="gb-unit-label">Session History</div>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] text-[12px]"
              aria-label="Close session history"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-1 px-4 py-2 border-b border-[var(--color-border)]">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'text-[11px] px-2 py-1 rounded-md border transition-colors',
                  filter === f.key
                    ? 'border-[var(--color-accent)] text-[var(--color-fg)]'
                    : 'border-[var(--color-border)] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && filtered.length === 0 ? (
              <div className="p-4 text-[12px] text-[var(--color-fg-subtle)]">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-[12px] text-[var(--color-fg-subtle)]">
                No events yet. Accept or reject a splice to populate history.
              </div>
            ) : (
              <ul className="flex flex-col">
                {filtered.map((e, i) => (
                  <EventRow key={`${e.timestamp}-${i}`} event={e} />
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function EventRow({ event }: { event: SessionEvent }) {
  const { icon, accent, primary, secondary } = describeEvent(event)
  return (
    <li className="flex items-start gap-3 px-4 py-3 border-b border-[var(--color-border)]">
      <div
        className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold"
        style={{ background: accent, color: 'var(--color-bg)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--color-fg)] truncate">{primary}</div>
        {secondary && (
          <div className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">{secondary}</div>
        )}
        <div className="gb-num text-[10px] text-[var(--color-fg-subtle)] mt-1">
          {formatTime(event.timestamp)}
        </div>
      </div>
    </li>
  )
}

function describeEvent(e: SessionEvent): {
  icon: string
  accent: string
  primary: string
  secondary?: string
} {
  const p = e.payload as Record<string, unknown>
  switch (e.event_type) {
    case 'diff_accepted':
      return {
        icon: '✓',
        accent: 'var(--color-accent)',
        primary: `Accepted ${str(p.summary) || str(p.diff_id)}`,
        secondary: undefined,
      }
    case 'diff_rejected':
      return {
        icon: '✕',
        accent: '#d44',
        primary: `Rejected ${str(p.summary) || str(p.diff_id)}`,
        secondary: str(p.reason) || undefined,
      }
    case 'param_changed':
      return {
        icon: '⚙',
        accent: 'var(--color-fg-subtle)',
        primary: `param ${str(p.param_name)} on ${str(p.node_id)}`,
        secondary: `${str(p.old_value)} → ${str(p.new_value)}`,
      }
    case 'session_started':
      return {
        icon: '▶',
        accent: 'var(--color-fg-muted)',
        primary: 'Session started',
        secondary: str(p.project_path),
      }
    case 'agent_run':
      return {
        icon: 'A',
        accent: 'var(--color-fg-muted)',
        primary: `Agent run: ${str(p.trigger)}`,
        secondary: str(p.outcome),
      }
    default:
      return {
        icon: '·',
        accent: 'var(--color-fg-subtle)',
        primary: e.event_type,
      }
  }
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
