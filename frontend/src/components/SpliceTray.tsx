import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAnalysis } from '@/lib/useAnalysis'
import { pywebview } from '@/lib/pywebview'
import { tokens } from '@/lib/tokens'
import type { Splice, SpliceCatalog, SplicePrimitive } from '@/types/analysis'
import { SpliceTile } from './SpliceTile'

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
          <div className="gb-unit-label">
            {PRIMITIVE_LABEL[primitive]}
          </div>
          {grouped[primitive].map((splice, idx) => (
            <motion.div
              key={splice.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * tokens.staggerTraySec, duration: tokens.durQuickSec }}
            >
              <SpliceTile
                splice={splice}
                isPending={pending?.splice.id === splice.id}
                onStage={() => stage(splice, 'tray')}
              />
            </motion.div>
          ))}
        </section>
      ))}
    </div>
  )
}
