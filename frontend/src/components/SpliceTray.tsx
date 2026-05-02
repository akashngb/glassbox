import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { pywebview } from '@/lib/pywebview'
import type { Splice, SpliceCatalog, SplicePrimitive } from '@/types/analysis'
import { cn } from '@/lib/cn'

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
      {(Object.keys(grouped) as SplicePrimitive[]).map(primitive => (
        <section key={primitive} className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {PRIMITIVE_LABEL[primitive]}
          </div>
          {grouped[primitive].map((splice, idx) => (
            <motion.button
              key={splice.id}
              type="button"
              onClick={() => stage(splice, 'tray')}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.18 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'group relative w-full text-left rounded-[var(--radius-tray)]',
                'bg-[var(--color-elevated)] border border-[var(--color-border)]',
                'px-3 py-2 transition-colors',
                'hover:border-[var(--color-fg-subtle)]',
                pending?.splice.id === splice.id && 'border-[var(--color-pending)]',
              )}
            >
              <div className="text-[13px] leading-tight">{splice.label}</div>
              <div className="mt-2 flex items-center gap-2">
                <MagnitudeBar value={splice.magnitude} />
                <div className="gb-num text-[10px] text-[var(--color-fg-subtle)]">
                  {Math.round(splice.magnitude * 100)}%
                </div>
              </div>
            </motion.button>
          ))}
        </section>
      ))}
    </div>
  )
}

function MagnitudeBar({ value }: { value: number }) {
  return (
    <div className="h-1 flex-1 rounded-full bg-[var(--color-border)] overflow-hidden">
      <div
        className="h-full bg-[var(--color-accent)]"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  )
}
