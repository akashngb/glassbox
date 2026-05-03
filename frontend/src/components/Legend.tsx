import { useState } from 'react'
import { BorderRotate } from './BorderRotate'

type Item = { color: string; label: string }

const ITEMS: Item[] = [
  { color: '#c7a03c', label: 'Hyperparameter group' },
  { color: '#5d7fc4', label: 'Hyperparameter slider' },
  { color: '#ff9a3d', label: 'SISA agent diff' },
  { color: '#52b1c4', label: 'Datapoint sample' },
  { color: '#b85ec8', label: 'Protected attribute' },
  { color: '#e85d3d', label: 'Proxy warning' },
]

// Vibrant cycling gradient for the expanded panel border.
const RAINBOW_BORDER = {
  primary:   '#ff9a3d',
  secondary: '#5d7fc4',
  accent:    '#b85ec8',
}

// Trash sits at bottom-6 (24px). It's 76px tall with a ~20px label above.
// Stack the collapsed key disk *directly* on top of the trash with no gap.
const TRASH_BOTTOM = 24
const TRASH_HEIGHT = 76
const TRASH_LABEL  = 20
const KEY_BOTTOM   = TRASH_BOTTOM + TRASH_HEIGHT + TRASH_LABEL  // 120
const PANEL_BOTTOM = TRASH_BOTTOM + TRASH_HEIGHT + 32           // expanded panel: 132

export function Legend() {
  const [open, setOpen] = useState(true)

  if (!open) return <CollapsedKey onClick={() => setOpen(true)} />

  return (
    <div
      className="absolute right-6 z-40 select-none"
      style={{ width: 232, bottom: PANEL_BOTTOM }}
    >
      {/* Soft halo behind the card so the rotating border feels like a glow. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[16px] pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 100%, rgba(184, 94, 200, 0.28), transparent 70%), ' +
            'radial-gradient(60% 80% at 0% 0%, rgba(93, 127, 196, 0.22), transparent 70%), ' +
            'radial-gradient(60% 80% at 100% 0%, rgba(255, 154, 61, 0.22), transparent 70%)',
          filter: 'blur(14px)',
          transform: 'scale(1.04)',
        }}
      />
      <BorderRotate
        animationMode="auto-rotate"
        animationSpeed={9}
        borderRadius={14}
        borderWidth={1.25}
        backgroundColor="#16191f"
        gradientColors={RAINBOW_BORDER}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          aria-label="Collapse key"
          className="w-full text-left cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2
                          text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            <span className="flex items-center gap-2">
              <KeyIcon size={11} />
              <span>Key</span>
            </span>
            <Chevron open />
          </div>

          <div className="px-4 pb-3">
            <div className="flex flex-col gap-1.5">
              {ITEMS.map(item => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      background: item.color,
                      boxShadow: `0 0 8px ${item.color}99`,
                    }}
                  />
                  <span className="text-[11.5px] text-[var(--color-fg-muted)]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </button>
      </BorderRotate>
    </div>
  )
}

function CollapsedKey({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open key"
      title="Show legend"
      className="absolute right-6 z-40 select-none transition-transform hover:scale-105 active:scale-95"
      style={{
        bottom: KEY_BOTTOM,
        width: TRASH_HEIGHT,
        height: TRASH_HEIGHT,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <BorderRotate
        animationMode="auto-rotate"
        animationSpeed={8}
        borderRadius={TRASH_HEIGHT / 2}
        borderWidth={1.25}
        backgroundColor="#1c2029"
        gradientColors={RAINBOW_BORDER}
        style={{ width: TRASH_HEIGHT, height: TRASH_HEIGHT }}
      >
        <div
          className="w-full h-full flex items-center justify-center rounded-full"
          style={{
            boxShadow:
              'inset 0 0 12px rgba(184, 94, 200, 0.18), ' +
              '0 0 14px rgba(93, 127, 196, 0.18)',
          }}
        >
          <KeyIcon size={26} />
        </div>
      </BorderRotate>
    </button>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 180ms var(--ease-out)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function KeyIcon({ size = 16 }: { size?: number }) {
  // Simple key — circle bow + shaft + two teeth.
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--color-fg-muted)' }}
    >
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9" />
      <path d="M17 12v3" />
      <path d="M20 12v2" />
    </svg>
  )
}
