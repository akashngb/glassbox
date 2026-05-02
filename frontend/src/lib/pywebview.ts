/**
 * Typed wrapper around window.pywebview.api.
 *
 * In dev mode (frontend running standalone via `vite dev`), pywebview is not
 * present. Calls fall through to a fixture loader so the UI works without
 * Python booted. In production, the real bridge takes over.
 */
import type { Analysis, Splice, SpliceCatalog, CaptionFraming } from '@/types/analysis'

export interface ModelIdentity {
  loaded: boolean
  dataset_path?: string
  n_samples?: number
  accuracy?: number
  n_flags?: number
  protected_attributes?: string[]
}

export interface BiasFlag {
  attribute: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  metric: string
  value: number
  threshold: number
  message: string
}

export interface BiasReport {
  dataset: { path: string; n_samples: number; n_features: number; n_train: number; n_test: number }
  protected_attributes: string[]
  baseline: { accuracy: number; metrics: Record<string, Record<string, number>> }
  bias_flags: BiasFlag[]
  recommendations: Array<{ priority: number; type: string; description: string; code: string }>
}

export interface RetuneReport {
  source_report: string
  n_flags: { HIGH?: number; MEDIUM?: number; LOW?: number }
  predicted_params: Record<string, string | number | null>
  rationale: string[]
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        baseline: () => Promise<Analysis>
        apply_splice: (head_id: string, splice: Splice) => Promise<Analysis>
        list_splices: () => Promise<SpliceCatalog>
        caption_for: (splice_id: string, framing: CaptionFraming) => Promise<string>
        echo: (msg: string) => Promise<string>
        bias_report: () => Promise<BiasReport | null>
        retune: () => Promise<RetuneReport | null>
        fix_message: () => Promise<string | null>
        model_identity: () => Promise<ModelIdentity>
      }
    }
  }
}

const PYWEBVIEW_BOOT_TIMEOUT_MS = 5000

function isApiReady(): boolean {
  return typeof window.pywebview?.api?.baseline === 'function'
}

function waitForPywebview(): Promise<boolean> {
  return new Promise((resolve) => {
    if (isApiReady()) return resolve(true)
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      window.removeEventListener('pywebviewready', onReady)
      resolve(ok)
    }
    const onReady = () => { if (isApiReady()) finish(true) }
    window.addEventListener('pywebviewready', onReady)

    const start = performance.now()
    const tick = () => {
      if (isApiReady()) return finish(true)
      if (performance.now() - start > PYWEBVIEW_BOOT_TIMEOUT_MS) return finish(false)
      requestAnimationFrame(tick)
    }
    tick()
  })
}

let bridgeReady: Promise<boolean> | null = null

export function pywebviewReady(): Promise<boolean> {
  if (!bridgeReady) bridgeReady = waitForPywebview()
  return bridgeReady
}

async function fixtureFallback<T>(load: () => Promise<T>): Promise<T> {
  return load()
}

export const pywebview = {
  async baseline(): Promise<Analysis> {
    if (await pywebviewReady()) return window.pywebview!.api.baseline()
    return fixtureFallback(async () => (await import('@/data/fixtures')).baseline)
  },

  async applySplice(headId: string, splice: Splice): Promise<Analysis> {
    if (await pywebviewReady()) return window.pywebview!.api.apply_splice(headId, splice)
    const { applyFixtureSplice } = await import('@/data/fixtures')
    return applyFixtureSplice(headId, splice)
  },

  async listSplices(): Promise<SpliceCatalog> {
    if (await pywebviewReady()) return window.pywebview!.api.list_splices()
    return (await import('@/data/fixtures')).spliceCatalog
  },

  async captionFor(spliceId: string, framing: CaptionFraming): Promise<string> {
    if (await pywebviewReady()) return window.pywebview!.api.caption_for(spliceId, framing)
    const { captionFor } = await import('@/data/fixtures')
    return captionFor(spliceId, framing)
  },

  async echo(msg: string): Promise<string> {
    if (await pywebviewReady()) return window.pywebview!.api.echo(msg)
    return `pong (fallback): ${msg}`
  },

  async biasReport(): Promise<BiasReport | null> {
    if (await pywebviewReady()) return window.pywebview!.api.bias_report()
    return null
  },

  async retune(): Promise<RetuneReport | null> {
    if (await pywebviewReady()) return window.pywebview!.api.retune()
    return null
  },

  async fixMessage(): Promise<string | null> {
    if (await pywebviewReady()) return window.pywebview!.api.fix_message()
    return null
  },

  async modelIdentity(): Promise<ModelIdentity> {
    if (await pywebviewReady()) return window.pywebview!.api.model_identity()
    return { loaded: false }
  },
}
