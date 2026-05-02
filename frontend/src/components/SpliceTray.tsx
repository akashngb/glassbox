import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { pywebview } from '@/lib/pywebview'
import { tokens } from '@/lib/tokens'
import { cn } from '@/lib/cn'
import type { Splice, SpliceCatalog, SplicePrimitive } from '@/types/analysis'
import { BorderRotate } from '@/components/ui/border-rotate'
import { palettes, paletteForPrimitive } from '@/lib/palettes'
import { FamilyGlyph } from './icons'

const PRIMITIVE_LABEL: Record<SplicePrimitive, string> = {
  unlearn:   'unlearn',
  reweight:  'reweight',
  smote:     'augment',
  threshold: 'threshold',
  fairlearn: 'constraint',
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
      {(Object.keys(grouped) as SplicePrimitive[]).map(primitive => {
        const palette = palettes[paletteForPrimitive(primitive)]
        return (
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
                  <BorderRotate
                    gradientColors={palette}
                    backgroundColor="#0a0a0b"
                    borderRadius={10}
                    borderWidth={1}
                    animationSpeed={6}
                    className={cn(
                      'cursor-grab active:cursor-grabbing w-full',
                      pending?.splice.id === splice.id && 'ring-1 ring-[var(--color-pending)]',
                    )}
                  >
                    <div
                      onClick={() => stage(splice, 'tray')}
                      className="px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="shrink-0 mt-0.5"
                          style={{ color: palette.secondary }}
                        >
                          <FamilyGlyph family={splice.primitive} size={20} />
                        </div>
                        <div className="text-[length:var(--gb-text-body)] leading-tight text-[var(--color-fg)] flex-1 min-w-0 truncate">
                          {splice.label}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <MagnitudeBar value={splice.magnitude} color={palette.secondary} />
                        <div className="gb-num text-[length:var(--gb-text-micro)] text-[var(--color-fg-subtle)]">
                          {Math.round(splice.magnitude * 100)}%
                        </div>
                      </div>
                    </div>
                  </BorderRotate>
                </div>
              </motion.div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function MagnitudeBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        className="h-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={tokens.springChrome}
      />
    </div>
  )
}
