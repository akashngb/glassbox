import { useEffect, useState, useId, useMemo } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions } from '@tsparticles/engine'
import { motion, useAnimation } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface SparklesCoreProps {
  id?: string
  className?: string
  background?: string
  particleColor?: string
  particleDensity?: number
  particleSize?: number
  minSize?: number
  maxSize?: number
  speed?: number
}

export function SparklesCore({
  id,
  className,
  background = 'transparent',
  particleColor = '#ffffff',
  particleDensity = 80,
  particleSize = 1,
  minSize = 0.6,
  maxSize = 1.4,
  speed = 1,
}: SparklesCoreProps) {
  const [ready, setReady] = useState(false)
  const controls = useAnimation()
  const generatedId = useId()

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setReady(true))
  }, [])

  const options = useMemo<ISourceOptions>(() => ({
    background: { color: { value: background } },
    fullScreen: { enable: false, zIndex: 1 },
    fpsLimit: 60,
    particles: {
      number: { value: particleDensity, density: { enable: true, area: 800 } },
      color: { value: particleColor },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.85 },
        animation: { enable: true, speed: speed, sync: false, startValue: 'random' },
      },
      size: {
        value: { min: minSize, max: maxSize },
      },
      move: {
        enable: true,
        speed: { min: 0.05, max: 0.4 },
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'out' },
      },
    },
    detectRetina: true,
  }), [background, particleColor, particleDensity, minSize, maxSize, particleSize, speed])

  return (
    <motion.div animate={controls} className={cn('opacity-100', className)}>
      {ready && (
        <Particles
          id={id ?? generatedId}
          className="h-full w-full"
          particlesLoaded={async () => { await controls.start({ opacity: 1 }) }}
          options={options}
        />
      )}
    </motion.div>
  )
}
