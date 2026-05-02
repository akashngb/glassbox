import { useRef, type CSSProperties, type ReactNode, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'

export type GlowColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'blue'
  | 'purple'
  | 'cyan'
  | 'magenta'

const GLOW_RGB: Record<GlowColor, string> = {
  red:     '239, 68, 68',
  orange:  '255, 154, 61',
  amber:   '245, 158, 11',
  green:   '16, 185, 129',
  blue:    '96, 165, 250',
  purple:  '167, 139, 250',
  cyan:    '34, 211, 238',
  magenta: '232, 121, 249',
}

export interface GlowCardProps {
  children: ReactNode
  glowColor?: GlowColor
  customSize?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

export function GlowCard({
  children,
  glowColor = 'blue',
  customSize = false,
  className,
  style,
  onClick,
}: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--gc-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--gc-y', `${e.clientY - rect.top}px`)
    el.style.setProperty('--gc-opacity', '1')
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--gc-opacity', '0')
  }

  const rgb = GLOW_RGB[glowColor]

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-[var(--radius-panel)]',
        'border border-[var(--color-border)]',
        'bg-[color-mix(in_oklab,var(--color-surface)_80%,transparent)]',
        'backdrop-blur-[14px] [backdrop-filter:var(--gb-glass-iridescence)]',
        'transition-colors',
        !customSize && 'w-full p-4',
        className,
      )}
      style={{
        ['--gc-rgb' as string]: rgb,
        ['--gc-opacity' as string]: '0',
        ...style,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 'var(--gc-opacity)',
          background:
            'radial-gradient(380px circle at var(--gc-x, 50%) var(--gc-y, 50%), rgba(var(--gc-rgb), 0.22), transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
        style={{
          background:
            'linear-gradient(135deg, rgba(var(--gc-rgb), 0.10), transparent 40%, rgba(var(--gc-rgb), 0.06))',
          mixBlendMode: 'screen',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
