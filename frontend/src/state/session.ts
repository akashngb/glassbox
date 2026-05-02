/**
 * Session memory UI state — toggleable drawer + boot-time resume info.
 *
 * Backed by glassbox/memory/session.py via the pywebview bridge.
 */
import { createContext, useContext } from 'react'

export interface SessionSummary {
  total: number
  accepted: number
  rejected: number
  param_changes: number
  last_session_started: number | null
}

export interface SessionInfo {
  available: boolean
  resumed: boolean
  summary: SessionSummary | null
  project_path: string | null
}

export interface SessionContextValue {
  info: SessionInfo | null
  historyOpen: boolean
  setHistoryOpen: (v: boolean) => void
  /** Increments after every accept/reject/param-change so the drawer refetches. */
  refreshVersion: number
  bumpHistory: () => void
  toastDismissed: boolean
  dismissToast: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const v = useContext(SessionContext)
  if (!v) throw new Error('useSession must be used inside <SessionProvider>')
  return v
}
