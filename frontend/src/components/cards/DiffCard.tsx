import { CardShell, CardHeader, Tone, paletteAccent } from './CardShell'
import type { DiffCard as Card, DiffLine } from '@/state/canvas'

type Props = {
  card: Card
  onAccept: (id: string) => void
  onReject: (id: string) => void
}

export function DiffCardView({ card, onAccept, onReject }: Props) {
  const status = card.status
  // All diff cards share the amber palette per the spec — status is shown
  // through the inner Tone pill, not the outline.
  const palette = 'amber' as const
  const tone =
    status === 'accepted' ? 'good' :
    status === 'rejected' ? 'neutral' :
    'warn'
  const label =
    status === 'accepted' ? 'accepted' :
    status === 'rejected' ? 'rejected' :
    'pending'

  const adds = card.hunks.filter(l => l.kind === 'add').length
  const dels = card.hunks.filter(l => l.kind === 'del').length

  return (
    <CardShell width={392} active={status === 'pending'} palette={palette}>
      <CardHeader
        eyebrow={`SISA agent · ${card.file}`}
        title={card.summary}
        right={<Tone label={label} tone={tone} />}
        accentColor={paletteAccent(palette)}
      />

      <div className="px-4 pt-3">
        <div className="text-[10px] gb-num text-[var(--color-fg-subtle)] mb-1.5 flex items-center gap-3">
          <span>{card.hunkHeader}</span>
          <span className="ml-auto">
            <span style={{ color: 'var(--color-good)' }}>+{adds}</span>
            <span className="mx-1 text-[var(--color-fg-subtle)]">·</span>
            <span style={{ color: 'var(--color-bad)' }}>−{dels}</span>
          </span>
        </div>
        <pre
          className="rounded-md border border-[var(--color-border)] overflow-hidden text-[11.5px] leading-[1.55] gb-num"
          style={{ background: '#0b0d12' }}
        >
          {card.hunks.map((line, i) => <DiffLineView key={i} line={line} />)}
        </pre>
      </div>

      <div className="px-4 pt-3 text-[11.5px] text-[var(--color-fg-muted)] leading-snug">
        {card.rationale}
      </div>

      <div className="px-4 pt-2 flex items-center gap-2 text-[10px] gb-num text-[var(--color-fg-subtle)]">
        <span>ΔDP{' '}
          <span style={{ color: card.expectedDpDelta < 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
            {card.expectedDpDelta >= 0 ? '+' : ''}{card.expectedDpDelta.toFixed(2)}
          </span>
        </span>
        <span>·</span>
        <span>ΔAcc{' '}
          <span style={{ color: card.expectedAccDelta >= 0 ? 'var(--color-good)' : 'var(--color-warn)' }}>
            {card.expectedAccDelta >= 0 ? '+' : ''}{(card.expectedAccDelta * 100).toFixed(1)}pp
          </span>
        </span>
      </div>

      {card.error && (
        <div
          className="mx-4 mt-3 px-2.5 py-1.5 rounded-md text-[10.5px] gb-num"
          style={{
            color: 'var(--color-bad)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
          }}
        >
          apply failed · {card.error}
        </div>
      )}

      <div className="px-4 pt-3 pb-4 flex items-center gap-2">
        <button
          type="button"
          data-no-drag
          disabled={status !== 'pending'}
          onClick={() => onAccept(card.id)}
          className="flex-1 text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-md
                     bg-[var(--color-accent)] text-[var(--color-bg)] font-bold
                     hover:bg-[var(--color-accent-strong)] transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Accept
        </button>
        <button
          type="button"
          data-no-drag
          disabled={status !== 'pending'}
          onClick={() => onReject(card.id)}
          className="flex-1 text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-md
                     border border-[var(--color-border)] text-[var(--color-fg-muted)]
                     hover:border-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reject
        </button>
        <button
          type="button"
          data-no-drag
          onClick={() => openMoreInfo(card.moreInfoUrl)}
          className="text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-md
                     border border-[var(--color-border)] text-[var(--color-fg-subtle)]
                     hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          title="Open the Backboard demo"
        >
          ⓘ More
        </button>
      </div>
    </CardShell>
  )
}

function DiffLineView({ line }: { line: DiffLine }) {
  if (line.kind === 'context') {
    return (
      <div className="grid grid-cols-[20px_1fr] items-baseline">
        <span className="text-center select-none text-[var(--color-fg-subtle)]"> </span>
        <span className="pr-3 py-[1px] whitespace-pre text-[var(--color-fg-muted)]">{line.text}</span>
      </div>
    )
  }
  const sign = line.kind === 'add' ? '+' : '−'
  const fg   = line.kind === 'add' ? 'var(--color-good)' : 'var(--color-bad)'
  const bg   = line.kind === 'add' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'
  return (
    <div className="grid grid-cols-[20px_1fr] items-baseline" style={{ background: bg }}>
      <span className="text-center select-none" style={{ color: fg }}>{sign}</span>
      <span className="pr-3 py-[1px] whitespace-pre" style={{ color: fg }}>{line.text}</span>
    </div>
  )
}

function openMoreInfo(url: string) {
  // All diff cards point at /backboard_demo.html — pywebview routes window.open
  // to the system browser, so the demo opens in a real Chrome/Safari tab.
  window.open(url, '_blank', 'noopener,noreferrer')
}
