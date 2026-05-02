import { useState } from 'react'
import { useSession } from '@/state/session'

export function CommandBar() {
  const [text, setText] = useState('')
  const { historyOpen, setHistoryOpen } = useSession()
  return (
    <div className="flex h-full items-center gap-3 px-5">
      <div className="gb-num text-xs text-[var(--color-fg-subtle)] tracking-wide">
        glassbox.open(<span className="text-[var(--color-fg-muted)]">"models/adult.pkl"</span>)
      </div>
      <div className="ml-auto flex items-center gap-2 w-1/2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="rebalance income predictions across sex…"
          className="flex-1 bg-[var(--color-elevated)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm placeholder:text-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)]"
        />
        <kbd className="gb-num text-[10px] text-[var(--color-fg-subtle)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
          ⏎
        </kbd>
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          aria-pressed={historyOpen}
          className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg-subtle)] transition-colors"
          title="Toggle session history"
        >
          History
        </button>
      </div>
    </div>
  )
}
