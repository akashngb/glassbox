import { forwardRef } from 'react'

type Props = {
  hover: boolean
}

export const Trash = forwardRef<HTMLDivElement, Props>(function Trash({ hover }, ref) {
  return (
    <div
      ref={ref}
      className="absolute bottom-6 right-6 select-none transition-all duration-150"
      style={{
        width: 76,
        height: 76,
        transform: hover ? 'scale(1.08)' : 'scale(1)',
        zIndex: 50,
      }}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center border transition-colors"
        style={{
          background: hover ? 'var(--color-bad)' : 'var(--color-elevated)',
          borderColor: hover ? 'var(--color-bad)' : 'var(--color-border)',
          boxShadow: hover ? '0 0 0 6px rgba(239, 68, 68, 0.15)' : 'none',
        }}
        aria-label="Drop here to delete card"
      >
        <TrashIcon stroke={hover ? 'var(--color-bg)' : 'var(--color-fg-muted)'} />
      </div>
      <div
        className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider whitespace-nowrap"
        style={{ color: hover ? 'var(--color-bad)' : 'var(--color-fg-subtle)' }}
      >
        {hover ? 'release to delete' : 'drag here'}
      </div>
    </div>
  )
})

function TrashIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
