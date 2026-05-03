import type { ReactNode } from 'react'
import { BorderRotate } from '../BorderRotate'

export type Palette = 'gold' | 'amber' | 'cyan' | 'violet' | 'red' | 'green' | 'blue' | 'grey' | 'pink'

const PALETTES: Record<Palette, { primary: string; secondary: string; accent: string; bg: string }> = {
  gold:   { primary: '#584827', secondary: '#c7a03c', accent: '#f9de90', bg: '#1c1812' },
  amber:  { primary: '#3d2718', secondary: '#ff9a3d', accent: '#ffd29a', bg: '#1d1410' },
  cyan:   { primary: '#1f3340', secondary: '#52b1c4', accent: '#a4e6f0', bg: '#0f1a20' },
  violet: { primary: '#3a1f3d', secondary: '#b85ec8', accent: '#e7a4f0', bg: '#1a0f1d' },
  red:    { primary: '#3d2118', secondary: '#e85d3d', accent: '#ffb89a', bg: '#1d100c' },
  green:  { primary: '#1f3d2c', secondary: '#3dc784', accent: '#a4f0c8', bg: '#0f1d16' },
  blue:   { primary: '#1f2940', secondary: '#5d7fc4', accent: '#a4b8f0', bg: '#0f1320' },
  grey:   { primary: '#262b35', secondary: '#5a5e6a', accent: '#9aa0ab', bg: '#16191f' },
  pink:   { primary: '#3d1f2e', secondary: '#e85d8b', accent: '#ffb8c8', bg: '#1d101a' },
}

type Props = {
  width?: number
  active?: boolean
  palette?: Palette
  loading?: boolean
  loadingHeight?: number
  children: ReactNode
}

export function CardShell({
  width = 232, active = false, palette = 'gold',
  loading = false, loadingHeight = 168, children,
}: Props) {
  const p = PALETTES[palette]
  return (
    <BorderRotate
      animationMode={loading || active ? 'auto-rotate' : 'rotate-on-hover'}
      animationSpeed={loading ? 2.5 : active ? 5 : 4}
      borderRadius={16}
      borderWidth={1.5}
      backgroundColor={p.bg}
      gradientColors={{
        primary: p.primary,
        secondary: p.secondary,
        accent: p.accent,
      }}
      style={{ width }}
    >
      {loading ? <Skeleton height={loadingHeight} accent={p.accent} /> : children}
    </BorderRotate>
  )
}

function Skeleton({ height, accent }: { height: number; accent: string }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: height }}
    >
      <div
        className="w-7 h-7 rounded-full border-2"
        style={{
          borderColor: 'var(--color-border)',
          borderTopColor: accent,
          animation: 'gb-spin 0.9s linear infinite',
        }}
      />
      <style>{`@keyframes gb-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function CardHeader({
  eyebrow, title, right, accentColor,
}: { eyebrow: string; title: string; right?: ReactNode; accentColor?: string }) {
  return (
    <div className="flex items-start gap-2 px-4 pt-4">
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase tracking-[0.12em]"
          style={{ color: accentColor ?? 'var(--color-fg-subtle)' }}
        >
          {eyebrow}
        </div>
        <div className="text-[14px] font-semibold leading-tight text-[var(--color-fg)] mt-1 truncate">
          {title}
        </div>
      </div>
      {right}
    </div>
  )
}

export function Tone({ label, tone }: { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const c =
    tone === 'good' ? 'var(--color-good)'
    : tone === 'warn' ? 'var(--color-warn)'
    : tone === 'bad'  ? 'var(--color-bad)'
    : 'var(--color-fg-subtle)'
  return (
    <div
      className="self-start text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: c, borderColor: c }}
    >
      {label}
    </div>
  )
}

export function paletteAccent(palette: Palette): string {
  return PALETTES[palette].accent
}
