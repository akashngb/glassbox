import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassboxProvider } from '@/state/GlassboxProvider'
import { initGsap } from '@/lib/gsapInit'
import { SessionProvider } from '@/state/SessionProvider'
import { App } from '@/App'
import '@/styles/globals.css'

initGsap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <GlassboxProvider>
        <App />
      </GlassboxProvider>
    </SessionProvider>
  </StrictMode>,
)
