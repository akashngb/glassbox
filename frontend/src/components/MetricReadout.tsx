import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export type MetricFormat = 'pp' | 'pct' | 'ratio' | 'count' | 'raw'

export interface MetricReadoutProps {
  value: number | string
  format?: MetricFormat
  unit?: ReactNode
  /** When set, draws a delta arrow + the delta value next to the metric. */
  delta?: number
  /** Show the metric at panel-headline scale (28px) vs body scale. */
  size?: 'lg' | 'md'
  className?: string
}

/**
 * The single readout primitive. Numbers render in mono with tabular-nums;
 * unit labels render in mono uppercase. Delta carries a sign and a direction
 * arrow. Used in Panel headers and Inspector breakdowns.
 */
export function MetricReadout({
  value,
  format = 'raw',
  unit,
  delta,
  size = 'lg',
  className,
}: MetricReadoutProps) {
  const formatted = formatValue(value, format)
  const sizeClass = size === 'lg'
    ? 'text-[length:var(--gb-text-headline)] font-semibold leading-[var(--gb-leading-display)]'
    : 'text-[length:var(--gb-text-body)] font-medium'

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className={cn('gb-num', sizeClass)}>{formatted}</span>
      {unit && (
        <span className="gb-unit-label" style={{ fontSize: 'var(--gb-text-micro)' }}>
          {unit}
        </span>
      )}
      {delta !== undefined && (
        <span
          className={cn(
            'gb-num text-[length:var(--gb-text-meta)]',
            delta > 0 ? 'text-[var(--color-bad)]' : delta < 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-fg-subtle)]',
          )}
        >
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {formatValue(Math.abs(delta), format)}
        </span>
      )}
    </div>
  )
}

function formatValue(v: number | string, fmt: MetricFormat): string {
  if (typeof v === 'string') return v
  switch (fmt) {
    case 'pp':    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}pp`
    case 'pct':   return `${(v * 100).toFixed(1)}%`
    case 'ratio': return v.toFixed(3)
    case 'count': return v >= 10000 ? v.toLocaleString('en-US').replace(/,/g, ' ') : `${v}`
    case 'raw':   return `${v}`
  }
}
