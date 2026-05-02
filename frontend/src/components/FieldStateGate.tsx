import { useEffect } from 'react'
import { gsap } from 'gsap'
import { useAnalysis } from '@/lib/useAnalysis'

/**
 * Sub-component of App that flips the `.gb-probe-field` host's data-pending
 * attribute and runs the accept-flash GSAP timeline. Lives outside ProbeField
 * so the field renderer never re-renders on pending state changes.
 */
export function FieldStateGate() {
  const { pending, timeline } = useAnalysis()

  // Dampen field opacity when a splice is staged.
  useEffect(() => {
    const field = document.querySelector('.gb-probe-field') as HTMLElement | null
    if (!field) return
    if (pending) {
      field.setAttribute('data-pending', 'true')
    } else {
      field.removeAttribute('data-pending')
    }
  }, [pending])

  // On accept (timeline grew while pending was non-null moments ago), flash the field.
  const tlLen = timeline.length
  useEffect(() => {
    if (tlLen <= 1) return
    const field = document.querySelector('.gb-probe-field') as HTMLElement | null
    if (!field) return

    const flash = gsap.timeline()
    flash
      .to(field, { opacity: 1, duration: 0.24, ease: 'power2.out' })
      .to(field, { opacity: 0.85, duration: 0.52, ease: 'dampen' })

    return () => { flash.kill() }
  }, [tlLen])

  return null
}
