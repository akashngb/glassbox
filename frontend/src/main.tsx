import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GlassboxProvider } from '@/state/GlassboxProvider'
import { App } from '@/App'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlassboxProvider>
      <App />
    </GlassboxProvider>
  </StrictMode>,
)
