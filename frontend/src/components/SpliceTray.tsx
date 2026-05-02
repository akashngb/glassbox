import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { pywebview } from '@/lib/pywebview'
import { tokens } from '@/lib/tokens'
import { cn } from '@/lib/cn'
import type { Splice, SpliceCatalog, SplicePrimitive } from '@/types/analysis'
import { GlowCard, type GlowColor } from '@/components/ui/spotlight-card'
import { FamilyGlyph } from './icons'

const PRIMITIVE_LABEL: Record<SplicePrimitive, string> = {
  unlearn:   'unlearn',
  reweight:  'reweight',
  smote:     'augment',
  threshold: 'threshold',
  fairlearn: 'constraint',
}

const PRIMITIVE_GLOW: Record<SplicePrimitive, GlowColor> = {
  unlearn:   'red',
  reweight:  'orange',
  smote:     'blue',
  threshold: 'purple',
  fairlearn: 'green',
}

const BAR_TINT: Record<GlowColor, string> = {
  red:     '#ef4444',
  orange:  'var(--color-accent)',
  amber:   '#f59e0b',
  green:   '#10b981',
  blue:    '#60a5fa',
  purple:  '#a78bfa',
  cyan:    '#22d3ee',
  magenta: '#e879f9',
}

export function SpliceTray() {
  const [catalog, setCatalog] = useState<SpliceCatalog>([])
  const { stage, pending } = useAnalysis()

  useEffect(() => {
    pywebview.listSplices().then(setCatalog)
  }, [])

  const grouped = catalog.reduce<Record<SplicePrimitive, Splice[]>>((acc, s) => {
    (acc[s.primitive] ??= []).push(s)
    return acc
  }, {} as Record<SplicePrimitive, Splice[]>)

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="gb-unit-label">Splice Tray</div>
      {(Object.keys(grouped) as SplicePrimitive[]).map(primitive => (
        <section key={primitive} className="flex flex-col gap-2">
          <div className="gb-unit-label">{PRIMITIVE_LABEL[primitive]}</div>
          {grouped[primitive].map((splice, idx) => (
            <motion.div
              key={splice.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * tokens.staggerTraySec, duration: tokens.durQuickSec }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
            >
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy'
                  e.dataTransfer.setData('application/x-glassbox-splice', splice.id)
                  document.body.dataset.dragSpliceId = splice.id
                }}
                onDragEnd={() => { delete document.body.dataset.dragSpliceId }}
              >
              <GlowCard
                glowColor={PRIMITIVE_GLOW[primitive]}
                customSize
                onClick={() => stage(splice, 'tray')}
                className={cn(
                  'cursor-grab active:cursor-grabbing w-full rounded-[var(--radius-tray)] px-3 py-2.5',
                  pending?.splice.id === splice.id && 'border-[var(--color-pending)]',
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="shrink-0 mt-0.5"
                    style={{ color: `var(--gb-family-${primitive})` }}
                  >
                    <FamilyGlyph family={splice.primitive} size={20} />
                  </div>
                  <div className="text-[length:var(--gb-text-body)] leading-tight text-[var(--color-fg)] flex-1 min-w-0 truncate">
                    {splice.label}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <MagnitudeBar value={splice.magnitude} color={PRIMITIVE_GLOW[primitive]} />
                  <div className="gb-num text-[length:var(--gb-text-micro)] text-[var(--color-fg-subtle)]">
                    {Math.round(splice.magnitude * 100)}%
                  </div>
                </div>
              </GlowCard>
              </div>
            </motion.div>
          ))}
        </section>
      ))}
    </div>
  )
}

function MagnitudeBar({ value, color }: { value: number; color: GlowColor }) {
  return (
    <div className="h-1 flex-1 rounded-full bg-[var(--color-border)] overflow-hidden">
      <motion.div
        className="h-full"
        style={{ background: BAR_TINT[color] }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={tokens.springChrome}
      />
    </div>
  )
}
