import { useEffect } from 'react'
import { useAnalysis } from '@/lib/useAnalysis'
import { pywebview } from '@/lib/pywebview'

declare global {
  interface Window {
    __glassboxDemo?: {
      stage: (spliceId: string) => Promise<void>
      accept: () => Promise<void>
      reject: () => void
      reset: () => Promise<void>
      catalog: () => Promise<{ id: string; label: string }[]>
      ready: true
    }
  }
}

export function DemoDriver() {
  const { stage, accept, reject } = useAnalysis()

  useEffect(() => {
    let pendingPromise: Promise<unknown> | null = null
    window.__glassboxDemo = {
      ready: true,
      async stage(spliceId: string) {
        const catalog = await pywebview.listSplices()
        const splice = catalog.find((s) => s.id === spliceId)
        if (!splice) throw new Error(`unknown splice ${spliceId}`)
        pendingPromise = stage(splice, 'tray')
        await pendingPromise
      },
      async accept() {
        await accept()
        await new Promise((r) => setTimeout(r, 60))
      },
      reject() {
        reject()
      },
      async reset() {
        await pywebview.resetAccepted()
      },
      async catalog() {
        const c = await pywebview.listSplices()
        return c.map((s) => ({ id: s.id, label: s.label }))
      },
    }
    return () => {
      delete window.__glassboxDemo
    }
  }, [stage, accept, reject])

  return null
}
