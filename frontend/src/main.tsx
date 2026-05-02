import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassboxProvider } from '@/state/GlassboxProvider'
import { initGsap } from '@/lib/gsapInit'
import { App } from '@/App'
import '@/styles/globals.css'

initGsap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlassboxProvider>
      <App />
    </GlassboxProvider>
  </StrictMode>,
)
