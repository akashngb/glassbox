import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { tokens } from '@/lib/tokens'
import type { PanelId } from '@/types/analysis'
import { useAnalysis } from '@/lib/useAnalysis'
import { BorderRotate } from '@/components/ui/border-rotate'
import { palettes, paletteForPanel, type PaletteName } from '@/lib/palettes'

export interface PanelProps {
  id: PanelId
  title: string
  unit?: string
  children: ReactNode
  metric: ReactNode
  subline?: ReactNode
}

export function Panel({ id, title, unit, children, metric, subline }: PanelProps) {
  const { head, selection, hovered, pending, timeline, select, hover } = useAnalysis()
  const [committed, setCommitted] = useState(false)
  const prevLenRef = useRef(timeline.length)

  useEffect(() => {
    if (timeline.length > prevLenRef.current) {
      setCommitted(true)
      const t = setTimeout(() => setCommitted(false), tokens.durEvent)
      prevLenRef.current = timeline.length
      return () => clearTimeout(t)
    }
    prevLenRef.current = timeline.length
  }, [timeline.length])

  const state = committed ? 'committed' : pending ? 'pending' : selection === id ? 'selected' : 'idle'

  let paletteName: PaletteName = paletteForPanel(id)
  if (id === 'flags' && head.panels.flags.length > 0) {
    paletteName = 'violet'
  }
  const palette = palettes[paletteName]

  return (
    <motion.div
      onMouseEnter={() => hover(id)}
      onMouseLeave={() => hover(null)}
      onClick={() => select(selection === id ? null : id)}
      animate={{
        scale: hovered === id ? 1.005 : 1,
      }}
      transition={tokens.springChrome}
      className="h-full cursor-pointer"
    >
      <BorderRotate
        gradientColors={palette}
        backgroundColor="#0a0a0b"
        borderRadius={12}
        borderWidth={1}
        animationSpeed={7}
        className="h-full"
      >
        <div data-state={state} className={cn('gb-panel flex flex-col gap-3')}>
          <header className="flex items-baseline justify-between">
            <div className="text-[12px] font-medium tracking-wide text-[var(--color-fg)] uppercase">
              {title}
            </div>
            {unit && <div className="gb-unit-label">{unit}</div>}
          </header>

          <div className="flex items-baseline gap-2">
            <div
              className="gb-display leading-none text-[var(--color-fg)]"
              style={{ fontSize: 'var(--gb-text-headline)' }}
            >
              {metric}
            </div>
            {subline && (
              <div className="font-mono text-[11px] text-[var(--color-fg-muted)]">
                {subline}
              </div>
            )}
          </div>

          <div className="mt-auto">
            {children}
          </div>
        </div>
      </BorderRotate>
    </motion.div>
  )
}
