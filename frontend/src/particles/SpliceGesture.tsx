import { useRef, useState, useEffect, useCallback } from 'react'
import { backboard } from '@/lib/backboard'
import { useAnalysis } from '@/lib/useAnalysis'
import { useProbes } from '@/state/probes'
import { tokens } from '@/lib/tokens'
import { pywebview } from '@/lib/pywebview'
import type { SpliceCatalog, SplicePrimitive } from '@/types/analysis'
import type { Probe } from '@/types/probes'

interface DragBox {
  x0: number; y0: number
  x1: number; y1: number
}

interface ArmState {
  startX: number; startY: number
  startTime: number
}

function clientToWorld(clientX: number, clientY: number, host: DOMRect): { x: number; y: number } {
  const x = ((clientX - host.left) / host.width) * 2 - 1
  const y = -(((clientY - host.top) / host.height) * 2 - 1)
  return { x, y }
}

function probesInRegion(probes: Probe[], box: DragBox): Probe[] {
  const xMin = Math.min(box.x0, box.x1)
  const xMax = Math.max(box.x0, box.x1)
  const yMin = Math.min(box.y0, box.y1)
  const yMax = Math.max(box.y0, box.y1)
  return probes.filter(p => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax)
}

function regionArea(box: DragBox): number {
  return Math.abs(box.x1 - box.x0) * Math.abs(box.y1 - box.y0)
}

function isCompatible(primitive: SplicePrimitive, region: Probe[]): boolean {
  if (region.length === 0) return false
  const attrs = region
    .map(p => p.protectedAttribute)
    .filter((a): a is 'sex' | 'race' | 'age' => a != null)

  switch (primitive) {
    case 'unlearn':
    case 'fairlearn':
      return true
    case 'reweight': {
      // Dominated by one attribute (≥70%).
      if (attrs.length === 0) return false
      const counts: Record<string, number> = {}
      attrs.forEach(a => { counts[a] = (counts[a] ?? 0) + 1 })
      const top = Math.max(...Object.values(counts))
      return top / attrs.length >= 0.7
    }
    case 'smote':
      return region.length >= tokens.dragMinProbes * 2
    case 'threshold': {
      // ≥80% of attributed probes must be 'age' (continuous).
      if (attrs.length === 0) return false
      const ageCount = attrs.filter(a => a === 'age').length
      return ageCount / attrs.length >= 0.8
    }
  }
}

export function SpliceGesture() {
  const hostRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<ArmState | null>(null)
  const [drag, setDrag] = useState<DragBox | null>(null)
  const [carrying, setCarrying] = useState(false)
  const { stage, setDragPhase, dragPhase } = useAnalysis()
  const { probes } = useProbes()
  const probesRef = useRef(probes)
  probesRef.current = probes
  const [catalog, setCatalog] = useState<SpliceCatalog>([])

  useEffect(() => {
    pywebview.listSplices().then(setCatalog)
  }, [])

  // Reset to idle on unmount.
  useEffect(() => () => { setDragPhase('idle') }, [setDragPhase])

  const cancelDrag = useCallback(() => {
    armRef.current = null
    setDrag(null)
    setCarrying(false)
    setDragPhase('idle')
  }, [setDragPhase])

  // Pointer-up + move handlers attached at window level so we don't lose the
  // drag when the cursor leaves the field overlay during carrying.
  useEffect(() => {
    if (!armRef.current && !drag) return

    const onMove = (e: PointerEvent) => {
      const host = hostRef.current?.getBoundingClientRect()
      if (!host) return

      // Arming → selecting transition.
      if (armRef.current && !drag) {
        const dx = e.clientX - (host.left + ((armRef.current.startX + 1) / 2) * host.width)
        const dy = e.clientY - (host.top + ((1 - armRef.current.startY) / 2) * host.height)
        if (Math.hypot(dx, dy) >= tokens.dragArmDistancePx) {
          const { x, y } = clientToWorld(e.clientX, e.clientY, host)
          setDrag({ x0: armRef.current.startX, y0: armRef.current.startY, x1: x, y1: y })
          setDragPhase('selecting')
        }
        return
      }

      if (!drag) return

      // Selecting / carrying — update rectangle endpoint.
      const { x, y } = clientToWorld(e.clientX, e.clientY, host)
      setDrag(d => d && { ...d, x1: x, y1: y })

      // Carrying transition: pointer leaves the host bounds.
      const inside =
        e.clientX >= host.left && e.clientX <= host.right &&
        e.clientY >= host.top && e.clientY <= host.bottom
      if (!inside && !carrying) {
        setCarrying(true)
        setDragPhase('carrying')
      } else if (inside && carrying) {
        setCarrying(false)
        setDragPhase('selecting')
      }
    }

    const onUp = (e: PointerEvent) => {
      // Cancel if we never armed past threshold.
      if (armRef.current && !drag) {
        cancelDrag()
        return
      }
      if (!drag) return

      // Find drop target via DOM hit-test on tray tiles.
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      const tile = els.find(el => el instanceof HTMLElement && el.dataset.spliceId) as HTMLElement | undefined
      const region = probesInRegion(probesRef.current, drag)

      if (regionArea(drag) < tokens.dragMinArea || region.length < tokens.dragMinProbes) {
        cancelDrag()
        return
      }

      if (tile && tile.dataset.spliceId) {
        const splice = catalog.find(s => s.id === tile.dataset.spliceId)
        if (splice && isCompatible(splice.primitive, region)) {
          setDragPhase('committing')
          stage(splice, 'tray').then(() => {
            // Splice the field region too so probes shift status.
            backboard.splice(
              {
                x0: Math.min(drag.x0, drag.x1),
                x1: Math.max(drag.x0, drag.x1),
                y0: Math.min(drag.y0, drag.y1),
                y1: Math.max(drag.y0, drag.y1),
              },
              splice.id,
            )
          })
          cancelDrag()
          return
        }
      }
      cancelDrag()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [drag, carrying, cancelDrag, setDragPhase, stage, catalog])

  // Update SpliceTray tile chrome based on drag state via document-level data-attr.
  useEffect(() => {
    document.body.dataset.dragPhase = dragPhase
  }, [dragPhase])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const host = hostRef.current?.getBoundingClientRect()
    if (!host) return
    const { x, y } = clientToWorld(e.clientX, e.clientY, host)
    armRef.current = { startX: x, startY: y, startTime: Date.now() }
    setDragPhase('arming')

    // Pressure-and-hold path: 300ms with no movement → arm anyway.
    setTimeout(() => {
      if (armRef.current && !drag) {
        setDrag({ x0: armRef.current.startX, y0: armRef.current.startY, x1: armRef.current.startX, y1: armRef.current.startY })
        setDragPhase('selecting')
      }
    }, 300)
  }

  const probeCount = drag ? probesInRegion(probesRef.current, drag).length : 0

  return (
    <div ref={hostRef} className="gb-probe-field-overlay" onPointerDown={onPointerDown}>
      {drag && <DragRect drag={drag} count={probeCount} carrying={carrying} />}
    </div>
  )
}

function DragRect({ drag, count, carrying }: { drag: DragBox; count: number; carrying: boolean }) {
  const left   = ((Math.min(drag.x0, drag.x1) + 1) / 2) * 100
  const right  = ((Math.max(drag.x0, drag.x1) + 1) / 2) * 100
  const top    = (1 - (Math.max(drag.y0, drag.y1) + 1) / 2) * 100
  const bottom = (1 - (Math.min(drag.y0, drag.y1) + 1) / 2) * 100
  const small = (right - left) < 8 || (bottom - top) < 8

  return (
    <div
      style={{
        position: 'absolute',
        left:   `${left}%`,
        right:  `${100 - right}%`,
        top:    `${top}%`,
        bottom: `${100 - bottom}%`,
        border: '1px dashed var(--color-pending)',
        background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
        pointerEvents: 'none',
        boxShadow: carrying ? 'var(--region-shadow-lift)' : 'none',
        transform: carrying ? 'translateY(-2px)' : 'none',
        transition: 'transform var(--dur-quick) var(--ease-out), box-shadow var(--dur-quick) var(--ease-out)',
        zIndex: 3,
      }}
    >
      {!small && (
        <div
          className="gb-num"
          style={{
            position: 'absolute',
            top: -18,
            right: 0,
            fontSize: 'var(--gb-text-micro)',
            color: 'var(--color-pending)',
            background: 'var(--gb-glass-tint-active)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-pill)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {count} {count === 1 ? 'probe' : 'probes'}
        </div>
      )}
    </div>
  )
}
