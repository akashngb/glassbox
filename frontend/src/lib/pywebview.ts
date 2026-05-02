/**
 * Typed wrapper around window.pywebview.api.
 *
 * In dev mode (frontend running standalone via `vite dev`), pywebview is not
 * present. Calls fall through to a fixture loader so the UI works without
 * Python booted. In production, the real bridge takes over.
 */
import type { Analysis, Splice, SpliceCatalog, CaptionFraming } from '@/types/analysis'
import type { SessionInfo } from '@/state/session'

declare global {
  interface Window {
    pywebview?: {
      api: {
        baseline: () => Promise<Analysis>
        apply_splice: (head_id: string, splice: Splice) => Promise<Analysis>
        list_splices: () => Promise<SpliceCatalog>
        caption_for: (splice_id: string, framing: CaptionFraming) => Promise<string>
        echo: (msg: string) => Promise<string>
        session_info: () => Promise<SessionInfo>
        session_history: (event_types?: string[] | null, limit?: number) => Promise<SessionEvent[]>
        accept_splice: (splice_id: string, summary: string, file_paths: string[]) => Promise<boolean>
        reject_splice: (splice_id: string, summary: string, reason: string) => Promise<boolean>
        change_param: (node_id: string, param_name: string, old_value: unknown, new_value: unknown) => Promise<boolean>
      }
    }
  }
}

export interface SessionEvent {
  event_type: 'session_started' | 'diff_accepted' | 'diff_rejected' | 'param_changed' | 'agent_run' | string
  payload: Record<string, unknown>
  timestamp: number
}

const PYWEBVIEW_BOOT_TIMEOUT_MS = 3000

function waitForPywebview(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.pywebview?.api) return resolve(true)
    const start = performance.now()
    const tick = () => {
      if (window.pywebview?.api) return resolve(true)
      if (performance.now() - start > PYWEBVIEW_BOOT_TIMEOUT_MS) return resolve(false)
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

  // ---- session memory ----

  async sessionInfo(): Promise<SessionInfo> {
    if (await pywebviewReady()) return window.pywebview!.api.session_info()
    return { available: false, resumed: false, summary: null, project_path: null }
  },

  async sessionHistory(eventTypes: string[] | null = null, limit = 200): Promise<SessionEvent[]> {
    if (await pywebviewReady()) return window.pywebview!.api.session_history(eventTypes, limit)
    return []
  },

  async acceptSplice(spliceId: string, summary = '', filePaths: string[] = []): Promise<boolean> {
    if (await pywebviewReady()) return window.pywebview!.api.accept_splice(spliceId, summary, filePaths)
    return false
  },

  async rejectSplice(spliceId: string, summary = '', reason = ''): Promise<boolean> {
    if (await pywebviewReady()) return window.pywebview!.api.reject_splice(spliceId, summary, reason)
    return false
  },

  async changeParam(nodeId: string, paramName: string, oldValue: unknown, newValue: unknown): Promise<boolean> {
    if (await pywebviewReady()) return window.pywebview!.api.change_param(nodeId, paramName, oldValue, newValue)
    return false
  },
}
