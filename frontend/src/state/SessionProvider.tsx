import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { pywebview } from '@/lib/pywebview'
import { SessionContext, type SessionInfo } from './session'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [toastDismissed, setToastDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    pywebview.sessionInfo().then(i => {
      if (!cancelled) setInfo(i)
    })
    return () => { cancelled = true }
  }, [])

  const bumpHistory = useCallback(() => {
    setRefreshVersion(v => v + 1)
  }, [])

  const dismissToast = useCallback(() => {
    setToastDismissed(true)
  }, [])

  return (
    <SessionContext.Provider
      value={{
        info,
        historyOpen,
        setHistoryOpen,
        refreshVersion,
        bumpHistory,
        toastDismissed,
        dismissToast,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
