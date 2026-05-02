/**
 * useAnalysis — the single seam between UI and data.
 *
 * Components never see Python or fixtures. They see this hook.
 * The hook never sees a reducer. It exposes ergonomic actions and computed reads.
 */
import { useCallback } from 'react'
import {
  head as headOf,
  useGlassboxDispatch,
  useGlassboxState,
} from '@/state/glassbox'
import { useSession } from '@/state/session'
import type { PanelId, Splice } from '@/types/analysis'
import type { DragPhase } from '@/state/glassbox'
import { pywebview } from './pywebview'

export function useAnalysis() {
  const state = useGlassboxState()
  const dispatch = useGlassboxDispatch()
  const { bumpHistory } = useSession()
  const head = state.timeline.length > 0 ? headOf(state).analysis : state.baseline

  const stage = useCallback(async (splice: Splice, from: 'tray' | 'command-bar' = 'tray') => {
    const parent = state.timeline.length > 0 ? headOf(state) : null
    const headId = parent?.id ?? 'baseline'
    const [ghost, caption] = await Promise.all([
      pywebview.applySplice(headId, splice),
      pywebview.captionFor(splice.id, 'accept'),
    ])
    dispatch({ kind: 'stage', splice, ghost, caption, from })
  }, [state, dispatch])

  const accept = useCallback(async () => {
    if (!state.pending) return
    const splice = state.pending.splice
    const caption = await pywebview.captionFor(splice.id, 'committed')
    dispatch({ kind: 'accept', caption })
    pywebview.acceptSplice(splice.id, splice.label).then((result) => {
      bumpHistory()
      if (result.written) {
        window.dispatchEvent(new CustomEvent('glassbox:accepted-changed', { detail: result }))
      }
    })
  }, [state, dispatch, bumpHistory])

  const reject = useCallback(() => {
    const splice = state.pending?.splice
    dispatch({ kind: 'reject' })
    if (splice) {
      pywebview.rejectSplice(splice.id, splice.label, '').then(() => bumpHistory())
    }
  }, [state, dispatch, bumpHistory])

  const select = useCallback((id: PanelId | null) => {
    dispatch({ kind: 'select', id })
  }, [dispatch])

  const hover = useCallback((id: PanelId | null) => {
    dispatch({ kind: 'hover', id })
  }, [dispatch])

  const scrub = useCallback((nodeId: string) => {
    dispatch({ kind: 'scrub', nodeId })
  }, [dispatch])

  const setDragPhase = useCallback((phase: DragPhase) => {
    dispatch({ kind: 'drag-phase', phase })
  }, [dispatch])

  return {
    head,
    ghost: state.pending?.ghost ?? null,
    pending: state.pending,
    selection: state.selection,
    hovered: state.hovered,
    timeline: state.timeline,
    dragPhase: state.dragPhase,

    stage,
    accept,
    reject,
    select,
    hover,
    scrub,
    setDragPhase,
  }
}
