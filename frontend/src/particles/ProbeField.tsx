import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useProbes } from '@/state/probes'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useAnalysis } from '@/lib/useAnalysis'
import { tokens } from '@/lib/tokens'
import type { Probe } from '@/types/probes'

const STATUS_COLOR_VAR: Record<Probe['status'], string> = {
  baseline:   '--probe-baseline',
  evaluating: '--probe-evaluating',
  detected:   '--probe-detected',
  spliced:    '--probe-spliced',
}

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const SPOTLIGHT_RADIUS = 0.55     // world units
const ATTRACTION_RADIUS = 0.30
const ATTRACTION_MAX_OFFSET = 0.04
const CAMERA_ZOOM = 280
const HOVER_RADIUS_PX = 28

interface CursorState {
  /** World-space x,y. NaN when cursor is outside the canvas. */
  x: number
  y: number
}

interface ProbePoint {
  position: THREE.Vector3
  color: THREE.Color
  targetColor: THREE.Color
  baseRadius: number
  phase: number
  /** Source-of-truth probe data; mutated by parent loop, read by mesh refs. */
  probe: Probe
  meshRef: { current: THREE.Mesh | null }
}

function FieldScene({
  cursorRef,
  setHovered,
}: {
  cursorRef: React.MutableRefObject<CursorState>
  setHovered: (probe: Probe | null) => void
}) {
  const { probes } = useProbes()
  const { pending, dragPhase } = useAnalysis()
  const points = useRef<Map<string, ProbePoint>>(new Map())
  const colorCache = useRef<Map<string, THREE.Color>>(new Map())
  const dampenRef = useRef(1.0)
  const targetDampenRef = useRef(1.0)
  const driftSpeed = tokens.probeDriftSpeed
  const pulsePeriodSec = tokens.probePulseMs / 1000
  const angularSpeed = (Math.PI * 2) / pulsePeriodSec  // rad/sec for pulse
  const { camera, size: viewportSize } = useThree()

  // Build / reconcile probe points map when probes list changes.
  const probeData = useMemo(() => {
    const next = new Map<string, ProbePoint>()
    for (const p of probes) {
      const existing = points.current.get(p.id)
      if (existing) {
        existing.probe = p
        next.set(p.id, existing)
      } else {
        next.set(p.id, {
          position: new THREE.Vector3(p.x, p.y, p.z * 0.5),
          color: new THREE.Color('#666'),
          targetColor: new THREE.Color('#666'),
          baseRadius: 0.012 + (p.confidence ?? 0) * 0.015,
          phase: Math.random() * Math.PI * 2,
          probe: p,
          meshRef: { current: null },
        })
      }
    }
    points.current = next
    return [...next.values()]
  }, [probes])

  // Update target colors when status changes (cheap; happens on ingest).
  useEffect(() => {
    for (const pt of probeData) {
      const key = pt.probe.status
      let cached = colorCache.current.get(key)
      if (!cached) {
        cached = new THREE.Color(readCssVar(STATUS_COLOR_VAR[pt.probe.status], '#888'))
        colorCache.current.set(key, cached)
      }
      pt.targetColor.copy(cached)
    }
  }, [probeData])

  // Track field-level dampening target based on splice-pending.
  useEffect(() => {
    targetDampenRef.current = pending ? tokens.probeDampenFactor : 1.0
  }, [pending])

  useFrame((state, delta) => {
    // Ease dampen toward target.
    dampenRef.current += (targetDampenRef.current - dampenRef.current) * Math.min(1, delta * 4)
    const elapsed = state.clock.elapsedTime

    const cursor = cursorRef.current
    const cursorActive = !Number.isNaN(cursor.x) && !Number.isNaN(cursor.y)
    const dragSilent = dragPhase !== 'idle'

    let nearestProbe: Probe | null = null
    let nearestDist2 = Infinity
    const hoverRadiusWorld = HOVER_RADIUS_PX / CAMERA_ZOOM

    for (const pt of probeData) {
      const mesh = pt.meshRef.current
      if (!mesh) continue
      const probe = pt.probe
      pt.phase += delta * driftSpeed * 12

      // Base position with sine drift wobble.
      let x = probe.x + Math.sin(pt.phase) * 0.015 * dampenRef.current
      let y = probe.y + Math.cos(pt.phase * 0.7) * 0.01 * dampenRef.current

      // Cursor attraction on baseline probes only.
      if (cursorActive && probe.status === 'baseline') {
        const dx = cursor.x - probe.x
        const dy = cursor.y - probe.y
        const d = Math.hypot(dx, dy)
        if (d < ATTRACTION_RADIUS) {
          const fall = (1 - d / ATTRACTION_RADIUS) ** 2
          x += dx * fall * ATTRACTION_MAX_OFFSET
          y += dy * fall * ATTRACTION_MAX_OFFSET
        }
      }

      mesh.position.x = x
      mesh.position.y = y
      mesh.position.z = probe.z * 0.5

      // Color migration toward target.
      pt.color.lerp(pt.targetColor, 0.08)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.copy(pt.color)

      // Opacity: status base + cursor spotlight + detected pulse.
      let opacity = probe.status === 'baseline' ? 0.42 : 0.85
      if (cursorActive) {
        const dxc = cursor.x - x
        const dyc = cursor.y - y
        const dc = Math.hypot(dxc, dyc)
        if (dc < SPOTLIGHT_RADIUS) {
          const boost = (1 - dc / SPOTLIGHT_RADIUS) ** 2
          opacity = Math.min(1, opacity + boost * 0.25)
        }
      }
      if (probe.status === 'detected') {
        const pulse = 0.6 + Math.sin(elapsed * angularSpeed + pt.phase) * 0.4
        opacity = pulse
      }
      mat.opacity = opacity * dampenRef.current

      // Hover hit-test (skip during drag).
      if (cursorActive && !dragSilent && (probe.status === 'detected' || probe.status === 'spliced')) {
        const dx = cursor.x - x
        const dy = cursor.y - y
        const d2 = dx * dx + dy * dy
        if (d2 < hoverRadiusWorld * hoverRadiusWorld && d2 < nearestDist2) {
          nearestDist2 = d2
          nearestProbe = probe
        }
      }
    }

    setHovered(nearestProbe)
  })

  // Wire camera + size to module-level so pointer handlers can convert NDC → world.
  useEffect(() => {
    cameraRef.current = camera as THREE.OrthographicCamera
    sizeRef.current = { width: viewportSize.width, height: viewportSize.height }
  }, [camera, viewportSize.width, viewportSize.height])

  return (
    <>
      <ambientLight intensity={0.3} />
      {probeData.map(pt => (
        <ProbeMesh key={pt.probe.id} point={pt} />
      ))}
    </>
  )
}

// Module-level refs so the canvas-host pointer listeners can compute world coords
// without prop-drilling.
const cameraRef: { current: THREE.OrthographicCamera | null } = { current: null }
const sizeRef: { current: { width: number; height: number } } = { current: { width: 0, height: 0 } }

function ProbeMesh({ point }: { point: ProbePoint }) {
  return (
    <mesh
      ref={(m) => { point.meshRef.current = m }}
      position={[point.probe.x, point.probe.y, point.probe.z * 0.5]}
    >
      <sphereGeometry args={[point.baseRadius, 8, 8]} />
      <meshBasicMaterial
        transparent
        opacity={point.probe.status === 'baseline' ? 0.42 : 0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function ReducedMotionField() {
  const { probes } = useProbes()
  return (
    <svg
      viewBox="-1 -1 2 2"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
    >
      {probes.map(p => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={0.012 + (p.confidence ?? 0) * 0.015}
          fill={`var(${STATUS_COLOR_VAR[p.status]})`}
          opacity={p.status === 'baseline' ? 0.42 : 0.85}
        />
      ))}
    </svg>
  )
}

function HoverTooltip({ probe }: { probe: Probe }) {
  const cam = cameraRef.current
  const sz = sizeRef.current
  if (!cam || sz.width === 0) return null

  // Project world to screen pixels.
  const screenX = probe.x * CAMERA_ZOOM + sz.width / 2
  const screenY = sz.height / 2 - probe.y * CAMERA_ZOOM

  // Anchor to the side with more space.
  const anchorLeft = screenX > sz.width * 0.6
  const x = anchorLeft ? screenX - 12 : screenX + 12
  const y = screenY - 8

  return (
    <div
      className="gb-glass absolute pointer-events-none z-30 rounded-[var(--radius-tray)] px-3 py-2"
      data-intensity="raised"
      style={{
        left: x,
        top: y,
        transform: anchorLeft ? 'translate(-100%, -100%)' : 'translate(0, -100%)',
        maxWidth: 280,
      }}
    >
      <div className="gb-unit-label" style={{ color: 'var(--probe-detected)' }}>
        {probe.status === 'spliced' ? 'spliced' : 'probe'} · {probe.protectedAttribute ?? '—'}
      </div>
      <div className="mt-1 text-[length:var(--gb-text-body)] leading-tight">
        {probe.label ?? '—'}
      </div>
      <div className="mt-1 text-[length:var(--gb-text-meta)] text-[var(--color-fg-muted)]">
        <span className="gb-num">{Math.round((probe.confidence ?? 0) * 100)}%</span>{' '}
        confidence — prediction shifts when {probe.protectedAttribute ?? 'attribute'} alone changes.
      </div>
    </div>
  )
}

export function ProbeField() {
  const reduced = useReducedMotion()
  const cursorRef = useRef<CursorState>({ x: NaN, y: NaN })
  const [hovered, setHovered] = useState<Probe | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  // Pointer listener at the host level so we capture even when r3f inertia/raycast misses.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    function onMove(e: PointerEvent) {
      const rect = host!.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      // Project to world: ortho camera centered, zoom 280 → world per pixel.
      const worldX = (px - rect.width / 2) / CAMERA_ZOOM
      const worldY = (rect.height / 2 - py) / CAMERA_ZOOM
      cursorRef.current.x = worldX
      cursorRef.current.y = worldY
    }
    function onLeave() {
      cursorRef.current.x = NaN
      cursorRef.current.y = NaN
    }
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    return () => {
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  if (reduced) {
    return (
      <div ref={hostRef} className="gb-probe-field">
        <ReducedMotionField />
      </div>
    )
  }

  return (
    <div ref={hostRef} className="gb-probe-field">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 5], zoom: CAMERA_ZOOM }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <FieldScene cursorRef={cursorRef} setHovered={setHovered} />
      </Canvas>
      {hovered && <HoverTooltip probe={hovered} />}
    </div>
  )
}
