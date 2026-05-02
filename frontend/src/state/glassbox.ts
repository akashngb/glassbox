/**
 * Glassbox state — single reducer, single source of truth.
 *
 * Three rules the reducer enforces:
 *   1. Pending is mutually exclusive with selection-edit. Dropping a second
 *      tray item replaces the first.
 *   2. Accept is the only path that mutates the timeline.
 *   3. Ghost is computed, not stored long-term. When pending becomes null,
 *      ghost goes null.
 */
import { createContext, useContext } from 'react'
import type { Analysis, PanelId, Splice } from '@/types/analysis'

export interface TimelineNode {
  id: string
  parentId: string | null
  splice: Splice | null   // null for the baseline node only
  analysis: Analysis
  caption: string         // committed-tense caption shown in the timeline ribbon
  acceptedAt: number
}

export interface PendingSplice {
  splice: Splice
  ghost: Analysis
  caption: string         // accept-framing caption shown in the inspector
  draggedFrom: 'tray' | 'command-bar'
}

export interface GlassboxState {
  baseline: Analysis
  timeline: TimelineNode[]
  pending: PendingSplice | null
  selection: PanelId | null
  hovered: PanelId | null
}

export type GlassboxAction =
  | { kind: 'init', baseline: Analysis }
  | { kind: 'stage', splice: Splice, ghost: Analysis, caption: string, from: PendingSplice['draggedFrom'] }
  | { kind: 'accept', caption: string }
  | { kind: 'reject' }
  | { kind: 'select', id: PanelId | null }
  | { kind: 'hover', id: PanelId | null }
  | { kind: 'scrub', nodeId: string }

export function head(state: GlassboxState): TimelineNode {
  return state.timeline[state.timeline.length - 1]
}

export const initialState: GlassboxState = {
  // Filled in by 'init' once baseline loads from the bridge.
  baseline: {
    id: 'baseline',
    caption: '',
    panels: {
      dpd:      { value: 0, history: [] },
      dir:      { value: 1, history: [] },
      eod:      { value: 0, history: [] },
      accuracy: { privileged: 0, unprivileged: 0, history: [] },
      flags:    [],
    },
  },
  timeline: [],
  pending: null,
  selection: null,
  hovered: null,
}

export function glassboxReducer(state: GlassboxState, action: GlassboxAction): GlassboxState {
  switch (action.kind) {
    case 'init': {
      const node: TimelineNode = {
        id: 'baseline',
        parentId: null,
        splice: null,
        analysis: action.baseline,
        caption: action.baseline.caption,
        acceptedAt: Date.now(),
      }
      return { ...state, baseline: action.baseline, timeline: [node], pending: null }
    }

    case 'stage':
      return {
        ...state,
        pending: {
          splice: action.splice,
          ghost: action.ghost,
          caption: action.caption,
          draggedFrom: action.from,
        },
      }

    case 'accept': {
      if (!state.pending) return state
      const parent = head(state)
      const next: TimelineNode = {
        id: `${parent.id}__${state.pending.splice.id}__${Date.now()}`,
        parentId: parent.id,
        splice: state.pending.splice,
        analysis: state.pending.ghost,
        caption: action.caption,
        acceptedAt: Date.now(),
      }
      return { ...state, timeline: [...state.timeline, next], pending: null }
    }

    case 'reject':
      return { ...state, pending: null }

    case 'select':
      return { ...state, selection: action.id }

    case 'hover':
      return { ...state, hovered: action.id }

    case 'scrub': {
      const idx = state.timeline.findIndex(n => n.id === action.nodeId)
      if (idx < 0) return state
      // Truncating to the scrubbed node would lose work; instead, just reset pending.
      return { ...state, pending: null }
    }

    default:
      return state
  }
}

export const GlassboxStateContext = createContext<GlassboxState | null>(null)
export const GlassboxDispatchContext = createContext<React.Dispatch<GlassboxAction> | null>(null)

export function useGlassboxState(): GlassboxState {
  const v = useContext(GlassboxStateContext)
  if (!v) throw new Error('useGlassboxState must be used inside <GlassboxProvider>')
  return v
}

export function useGlassboxDispatch(): React.Dispatch<GlassboxAction> {
  const v = useContext(GlassboxDispatchContext)
  if (!v) throw new Error('useGlassboxDispatch must be used inside <GlassboxProvider>')
  return v
}
