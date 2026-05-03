import { useRef, useState, type ReactNode } from 'react'

type Props = {
  id: string
  x: number
  y: number
  z: number
  zoom?: number
  onMove: (id: string, x: number, y: number) => void
  onDrop: (id: string, clientX: number, clientY: number) => void
  onPointerDownExtra?: () => void
  children: ReactNode
}

const NON_DRAG_SELECTOR = 'input, button, select, textarea, [data-no-drag]'

export function DraggableCard({ id, x, y, z, zoom = 1, onMove, onDrop, onPointerDownExtra, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ pointerX: number; pointerY: number; cardX: number; cardY: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest(NON_DRAG_SELECTOR)) return
    e.preventDefault()
    onPointerDownExtra?.()
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, cardX: x, cardY: y }
    setDragging(true)
    ref.current?.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startRef.current) return
    // Pointer deltas are in screen pixels; world coords are scaled by `zoom`,
    // so divide so the card tracks the cursor at any zoom level.
    const dx = (e.clientX - startRef.current.pointerX) / zoom
    const dy = (e.clientY - startRef.current.pointerY) / zoom
    onMove(id, startRef.current.cardX + dx, startRef.current.cardY + dy)
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!startRef.current) return
    onDrop(id, e.clientX, e.clientY)
    startRef.current = null
    setDragging(false)
    ref.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: dragging ? 9999 : z,
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        transition: dragging ? 'none' : 'box-shadow 160ms ease',
        filter: dragging ? 'drop-shadow(0 18px 40px rgba(0,0,0,0.55))' : 'none',
      }}
    >
      {children}
    </div>
  )
}
