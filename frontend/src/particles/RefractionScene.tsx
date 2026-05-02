import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, MeshTransmissionMaterial } from '@react-three/drei'
import type { Mesh } from 'three'
import { useAnalysis } from '@/lib/useAnalysis'

export function RefractionScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 5], fov: 38 }}
      className="!absolute !inset-0"
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#a78bfa" />
      <Suspense fallback={null}>
        <RefractiveCube />
        <Environment preset="studio" environmentIntensity={0.6} />
      </Suspense>
    </Canvas>
  )
}

function RefractiveCube() {
  const mesh = useRef<Mesh>(null)
  const { pending, head } = useAnalysis()

  const tiltTarget = useRef(0)
  const aberrationTarget = useRef(0.4)
  const pulse = useRef(0)

  useFrame((state, delta) => {
    if (!mesh.current) return
    const t = state.clock.elapsedTime

    tiltTarget.current = pending ? 0.5 : 0
    aberrationTarget.current = pending ? 1.2 : 0.4

    mesh.current.rotation.y += delta * 0.18
    mesh.current.rotation.x = lerp(mesh.current.rotation.x, Math.sin(t * 0.4) * 0.12 + tiltTarget.current, 0.04)
    mesh.current.rotation.z = lerp(mesh.current.rotation.z, tiltTarget.current * 0.6, 0.04)

    const breathe = 1 + Math.sin(t * 0.9) * 0.015
    const pendingScale = pending ? 1.04 : 1
    const target = breathe * pendingScale * (1 + pulse.current)
    mesh.current.scale.setScalar(lerp(mesh.current.scale.x, target, 0.08))

    pulse.current = lerp(pulse.current, 0, 0.05)

    const mat = mesh.current.material as { chromaticAberration?: number; distortion?: number; thickness?: number }
    if (mat && 'chromaticAberration' in mat) {
      mat.chromaticAberration = lerp(mat.chromaticAberration ?? 0.4, aberrationTarget.current, 0.06)
      mat.distortion = lerp(mat.distortion ?? 0.2, pending ? 0.45 : 0.18, 0.06)
    }
  })

  void head

  return (
    <mesh ref={mesh} rotation={[0.4, 0.6, 0]} scale={1.6}>
      <boxGeometry args={[1.55, 1.55, 1.55, 4, 4, 4]} />
      <MeshTransmissionMaterial
        transmission={1}
        thickness={1.2}
        roughness={0.05}
        ior={1.5}
        chromaticAberration={0.4}
        anisotropy={1}
        distortion={0.2}
        distortionScale={0.4}
        temporalDistortion={0.08}
        backside
        backsideThickness={0.6}
        attenuationDistance={2.5}
        attenuationColor="#dfe7ff"
        color="#ffffff"
      />
    </mesh>
  )
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
