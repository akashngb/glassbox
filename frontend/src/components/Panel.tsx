import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { PanelId } from '@/types/analysis'
import { useAnalysis } from '@/lib/useAnalysis'

export interface PanelProps {
  id: PanelId
  title: string
  unit?: string
  children: ReactNode
  metric: ReactNode      // the big number / readout
  subline?: ReactNode    // small contextual text under metric
}

export function Panel({ id, title, unit, children, metric, subline }: PanelProps) {
  const { selection, hovered, pending, select, hover } = useAnalysis()
  const state = pending ? 'pending' : selection === id ? 'selected' : 'idle'

  return (
    <motion.div
      data-state={state}
      className={cn('gb-panel cursor-pointer flex flex-col gap-3')}
      onMouseEnter={() => hover(id)}
      onMouseLeave={() => hover(null)}
      onClick={() => select(selection === id ? null : id)}
      animate={{
        scale: hovered === id ? 1.005 : 1,
      }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
    >
      <header className="flex items-baseline justify-between">
        <div className="text-[12px] font-bold tracking-wide text-[var(--color-fg)]">
          {title}
        </div>
        {unit && <div className="gb-unit-label">{unit}</div>}
      </header>

      <div className="flex items-baseline gap-2">
        <div className="gb-num text-[28px] font-semibold leading-none">{metric}</div>
        {subline && <div className="text-[11px] text-[var(--color-fg-muted)]">{subline}</div>}
      </div>

      <div className="mt-auto">
        {children}
      </div>
    </motion.div>
  )
}
