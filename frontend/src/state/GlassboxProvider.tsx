import { useEffect, useReducer, type ReactNode } from 'react'
import {
  GlassboxDispatchContext,
  GlassboxStateContext,
  glassboxReducer,
  initialState,
} from './glassbox'
import { pywebview } from '@/lib/pywebview'

export function GlassboxProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(glassboxReducer, initialState)

  useEffect(() => {
    let cancelled = false
    pywebview.baseline().then(baseline => {
      if (cancelled) return
      dispatch({ kind: 'init', baseline })
    })
    return () => { cancelled = true }
  }, [])

  return (
    <GlassboxStateContext.Provider value={state}>
      <GlassboxDispatchContext.Provider value={dispatch}>
        {children}
      </GlassboxDispatchContext.Provider>
    </GlassboxStateContext.Provider>
  )
}
