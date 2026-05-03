import { useEffect, useRef, useState } from 'react'
import { useCanvas, type Card } from '@/state/canvas'
import { DraggableCard } from './cards/DraggableCard'
import { CardShell } from './cards/CardShell'
import { ParamGroupCardView } from './cards/ParamGroupCard'
import { DatapointCardView } from './cards/DatapointCard'
import { ProtectedCardView } from './cards/ProtectedCard'
import { ProxyCardView } from './cards/ProxyCard'
import { DiffCardView } from './cards/DiffCard'
import { SliderCardView } from './cards/SliderCard'
import { Trash } from './cards/Trash'
import { BiasMeter } from './BiasMeter'
import { Legend } from './Legend'
import { HistoryControls } from './HistoryControls'

const ZOOM_MIN = 0.4
const ZOOM_MAX = 1.6

export function Workspace() {
  const {
    cards, series, latest,
    moveCard, bringToFront, deleteCard,
    acceptDiff, rejectDiff, pushReading, setSliderValue, setDiffError,
    undo, redo, canUndo, canRedo,
  } = useCanvas()
  const trashRef = useRef<HTMLDivElement | null>(null)
  const [trashHover, setTrashHover] = useState(false)

  // Infinite canvas pan offset — applied to the "world" div via translate.
  // `pan`/`zoom` are the *displayed* values that React renders; `targetRef`
  // is the live destination set by event handlers. An rAF loop lerps the
  // displayed values toward the target each frame so trackpad scroll, pinch,
  // and slider zoom all feel smooth instead of step-jumping per event.
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const panStartRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null)
  const worldRef = useRef<HTMLDivElement | null>(null)

  const targetRef = useRef({ panX: 0, panY: 0, zoom: 1 })
  const rafRef = useRef<number | null>(null)

  // Smoothing factor per frame. 0.28 → ~92% of a step covered in 4 frames at
  // 60fps (~67ms). Crisp enough to feel responsive, soft enough to glide.
  const LERP = 0.28
  const STOP_PAN = 0.15      // px — below this we snap to target
  const STOP_ZOOM = 0.0008   // zoom — below this we snap to target

  function ensureRaf() {
    if (rafRef.current != null) return
    const tick = () => {
      const t = targetRef.current
      let stillAnimating = false

      setPan(p => {
        const dx = t.panX - p.x
        const dy = t.panY - p.y
        if (Math.abs(dx) < STOP_PAN && Math.abs(dy) < STOP_PAN) {
          return p.x === t.panX && p.y === t.panY ? p : { x: t.panX, y: t.panY }
        }
        stillAnimating = true
        return { x: p.x + dx * LERP, y: p.y + dy * LERP }
      })
      setZoom(z => {
        const dz = t.zoom - z
        if (Math.abs(dz) < STOP_ZOOM) return z === t.zoom ? z : t.zoom
        stillAnimating = true
        return z + dz * LERP
      })

      rafRef.current = stillAnimating ? requestAnimationFrame(tick) : null
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function isOverTrash(clientX: number, clientY: number): boolean {
    const el = trashRef.current
    if (!el) return false
    const r = el.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  }

  function handleDrop(id: string, clientX: number, clientY: number) {
    if (isOverTrash(clientX, clientY)) deleteCard(id)
    setTrashHover(false)
  }

  function handlePointerMoveCapture(e: React.PointerEvent) {
    // Trash hover detection — independent of pan.
    if (e.buttons & 1) setTrashHover(isOverTrash(e.clientX, e.clientY))
    else if (trashHover) setTrashHover(false)
  }

  function applyDiffEffect(id: string) {
    const c = cards.find(card => card.id === id)
    if (!c || c.kind !== 'diff') return
    pushReading(c.expectedDpDelta, c.expectedDpDelta * 0.85, c.expectedAccDelta)
  }

  // Accept = run real file edits via the pywebview API, then mark accepted +
  // ripple the bias delta. If apply_diff fails we leave the card pending and
  // surface the error inline so the user knows nothing was written.
  async function handleAcceptDiff(id: string) {
    const c = cards.find(card => card.id === id)
    if (!c || c.kind !== 'diff') return

    type DiffApi = {
      apply_diff: (file: string, edits: { search: string; replace: string }[]) => Promise<{
        ok: boolean; error?: string
      }>
      reject_splice?: (id: string, summary: string, reason: string) => Promise<boolean>
    }
    const api: DiffApi | undefined = (window as unknown as { pywebview?: { api: DiffApi } }).pywebview?.api

    if (api?.apply_diff && c.edits.length > 0) {
      try {
        const result = await api.apply_diff(c.file, c.edits)
        if (!result.ok) {
          setDiffError(id, result.error || 'apply_diff failed')
          return
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setDiffError(id, msg)
        return
      }
    }

    acceptDiff(id)
    applyDiffEffect(id)
  }

  async function handleRejectDiff(id: string) {
    const c = cards.find(card => card.id === id)
    if (!c || c.kind !== 'diff') return
    type RejectApi = { reject_splice?: (id: string, summary: string, reason: string) => Promise<boolean> }
    const api: RejectApi | undefined = (window as unknown as { pywebview?: { api: RejectApi } }).pywebview?.api
    if (api?.reject_splice) {
      try { await api.reject_splice(c.id, c.summary, '') } catch { /* logging only */ }
    }
    rejectDiff(id)
  }

  // ── Background pan handlers (world-bg only, never on a card) ────────────────
  function bgPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return  // a card was clicked, ignore
    // Use the live target so a drag started mid-animation doesn't snap back.
    panStartRef.current = {
      pointerX: e.clientX, pointerY: e.clientY,
      panX: targetRef.current.panX, panY: targetRef.current.panY,
    }
    setPanning(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function bgPointerMove(e: React.PointerEvent) {
    if (!panStartRef.current) return
    targetRef.current.panX = panStartRef.current.panX + e.clientX - panStartRef.current.pointerX
    targetRef.current.panY = panStartRef.current.panY + e.clientY - panStartRef.current.pointerY
    ensureRaf()
  }

  function bgPointerUp(e: React.PointerEvent) {
    panStartRef.current = null
    setPanning(false)
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // Trackpad / wheel scroll → pan, *unless* the user pinches: macOS reports
  // pinch as wheel + ctrlKey. We zoom around the cursor so the point under
  // the pinch fingers stays anchored.
  function onWheel(e: React.WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.01)
      zoomAroundPoint(e.clientX, e.clientY, factor)
      return
    }
    targetRef.current.panX -= e.deltaX
    targetRef.current.panY -= e.deltaY
    ensureRaf()
  }

  function zoomAroundPoint(clientX: number, clientY: number, factor: number) {
    const t = targetRef.current
    const prevZoom = t.zoom
    const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prevZoom * factor))
    const realFactor = nextZoom / prevZoom
    // Adjust target pan so the world coord under the cursor stays anchored:
    //   client = pan + zoom * world  ⇒  pan' = client - zoom' * world
    //                            world = (client - pan) / zoom
    t.zoom = nextZoom
    t.panX = clientX - realFactor * (clientX - t.panX)
    t.panY = clientY - realFactor * (clientY - t.panY)
    ensureRaf()
  }

  function handleZoom(z: number) {
    targetRef.current.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    ensureRaf()
  }

  function resetView() {
    targetRef.current.panX = 0
    targetRef.current.panY = 0
    targetRef.current.zoom = 1
    ensureRaf()
  }

  // React's synthetic wheel events are passive by default → preventDefault()
  // inside the React handler is a no-op, which means the page scrolls *under*
  // the pinch. Attach a non-passive native listener to actually block the
  // browser's default zoom-in-page behavior on pinch.
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function nativeWheel(ev: WheelEvent) {
      if (!ev.ctrlKey) return
      ev.preventDefault()
      const factor = Math.exp(-ev.deltaY * 0.01)
      zoomAroundPoint(ev.clientX, ev.clientY, factor)
    }
    el.addEventListener('wheel', nativeWheel, { passive: false })
    return () => el.removeEventListener('wheel', nativeWheel)
    // zoomAroundPoint is stable across renders (closes over setZoom/setPan only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onPointerMoveCapture={handlePointerMoveCapture}
      onWheel={onWheel}
    >
      {/* World — translates + scales under the fixed BiasMeter + Trash. */}
      <div
        ref={worldRef}
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          cursor: panning ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onPointerDown={bgPointerDown}
        onPointerMove={bgPointerMove}
        onPointerUp={bgPointerUp}
        onPointerCancel={bgPointerUp}
      >
        {cards.map(card => {
          if (!card.visible) return null
          return (
            <DraggableCard
              key={card.id}
              id={card.id}
              x={card.x}
              y={card.y}
              z={card.z}
              zoom={zoom}
              onMove={moveCard}
              onDrop={handleDrop}
              onPointerDownExtra={() => bringToFront(card.id)}
            >
              <Appear>
                {renderCard(card, {
                  acceptDiff: handleAcceptDiff,
                  rejectDiff: handleRejectDiff,
                  setSliderValue,
                })}
              </Appear>
            </DraggableCard>
          )
        })}
      </div>

      {/* Fixed in screen space — unaffected by pan or zoom. */}
      <HistoryControls
        canUndo={canUndo} canRedo={canRedo}
        onUndo={undo} onRedo={redo}
        zoom={zoom} onZoomChange={handleZoom}
        zoomMin={ZOOM_MIN} zoomMax={ZOOM_MAX}
      />
      <BiasMeter series={series} latest={latest} />
      <Legend />
      <Trash ref={trashRef} hover={trashHover} />
      <PanHint pan={pan} zoom={zoom} onReset={resetView} />
    </div>
  )
}

type Helpers = {
  acceptDiff: (id: string) => void
  rejectDiff: (id: string) => void
  setSliderValue: (id: string, value: number) => void
}

function renderCard(card: Card, h: Helpers) {
  if (card.loading) return loadingShell(card)

  switch (card.kind) {
    case 'datapoint':   return <DatapointCardView card={card} />
    case 'protected':   return <ProtectedCardView card={card} />
    case 'param-group': return <ParamGroupCardView card={card} />
    case 'proxy':       return <ProxyCardView card={card} />
    case 'slider':      return <SliderCardView card={card} onChange={h.setSliderValue} />
    case 'diff':        return <DiffCardView card={card} onAccept={h.acceptDiff} onReject={h.rejectDiff} />
  }
}

function loadingShell(card: Card) {
  switch (card.kind) {
    case 'datapoint':   return <CardShell width={224} palette="cyan"   loading loadingHeight={170}><div /></CardShell>
    case 'protected':   return <CardShell width={244} palette="violet" loading loadingHeight={220}><div /></CardShell>
    case 'param-group': return <CardShell width={252} palette={card.palette} loading loadingHeight={220}><div /></CardShell>
    case 'proxy':       return <CardShell width={244} palette="red"    loading loadingHeight={170}><div /></CardShell>
    case 'slider':      return <CardShell width={272} palette="blue"   loading loadingHeight={208}><div /></CardShell>
    case 'diff':        return <CardShell width={392} palette="amber"  loading loadingHeight={300}><div /></CardShell>
  }
}

// note: card.palette is now uniformly 'gold' for all hyperparameter groups,
// so the legend's gold dot covers the entire group category.

function Appear({ children }: { children: React.ReactNode }) {
  return (
    <div className="gb-card-appear">
      {children}
      <style>{`
        @keyframes gb-card-appear {
          from { opacity: 0; transform: translateY(6px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .gb-card-appear { animation: gb-card-appear 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  )
}

function PanHint({
  pan, zoom, onReset,
}: { pan: { x: number; y: number }; zoom: number; onReset: () => void }) {
  const moved = pan.x !== 0 || pan.y !== 0 || zoom !== 1
  return (
    <div
      className="absolute bottom-6 left-6 z-40 select-none flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]"
      style={{ color: 'var(--color-fg-subtle)' }}
    >
      <span className="px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)]">
        drag bg · scroll · to pan
      </span>
      {moved && (
        <button
          type="button"
          onClick={onReset}
          className="px-2 py-1 rounded-md border border-[var(--color-border)]
                     hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors
                     bg-[var(--color-elevated)]"
        >
          reset view
        </button>
      )}
    </div>
  )
}
