import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { tokens } from '@/lib/tokens'
import { useReducedMotion } from '@/lib/useReducedMotion'

/**
 * SceneRoot owns the one-shot boot timeline. Mounts once at App level, runs
 * the staggered reveal (panels → timeline → command bar), then never replays.
 *
 * Stage 4: also gates `pending`-driven dampening of the probe field at the
 * <body data-scene="..."> level so any descendant component can react via
 * data-attr selectors without consuming the reducer directly.
 */
interface SceneRootProps {
  children: ReactNode
}

export function SceneRoot({ children }: SceneRootProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const panels = root.querySelector('.gb-bento-canvas')
    const cmd = root.querySelector('.gb-cmd-host')
    const tray = root.querySelector('.gb-tray-host')
    const inspector = root.querySelector('.gb-inspector-host')
    const tline = root.querySelector('.gb-tline-host')
    const probeField = root.querySelector('.gb-probe-field') as HTMLElement | null
    const visible = [panels, cmd, tray, inspector, tline].filter(Boolean) as Element[]

    const settle = () => {
      gsap.set(visible, { opacity: 1, y: 0, clearProps: 'transform' })
      if (probeField) gsap.set(probeField, { opacity: 0.85 })
    }

    if (reduced) {
      // Skip choreography under reduced-motion: just paint everything visible.
      settle()
      return
    }

    // Pre-paint state.
    gsap.set(visible, { opacity: 0 })
    gsap.set(panels, { y: 12 })
    gsap.set(tline, { y: 16 })
    if (probeField) gsap.set(probeField, { opacity: 0 })

    // Boot timeline.
    const tl = gsap.timeline()
    tl.to(probeField, {
      opacity: 0.85,
      duration: tokens.durBootSec,
      ease: 'dampen',
    })
      .to([cmd, tray], {
        opacity: 1,
        duration: tokens.durBaseSec,
        ease: 'power3.out',
        stagger: tokens.staggerPanelSec,
      }, 0.18)
      .to(panels, {
        opacity: 1,
        y: 0,
        duration: tokens.durBaseSec,
        ease: 'power3.out',
      }, 0.32)
      .to(inspector, {
        opacity: 1,
        duration: tokens.durQuickSec,
        ease: 'power3.out',
      }, 0.48)
      .to(tline, {
        opacity: 1,
        y: 0,
        duration: tokens.durBaseSec,
        ease: 'power3.out',
      }, 0.6)

    return () => {
      tl.kill()
      // StrictMode runs effect → cleanup → effect again. If the killed timeline
      // hadn't reached opacity 1, we'd be stuck invisible. Force visible state
      // on teardown so the next mount paints from a clean baseline.
      settle()
    }
  }, [reduced])

  return <div ref={containerRef} className="contents">{children}</div>
}
