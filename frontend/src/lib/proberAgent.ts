/**
 * Fixture replay — simulates Backboard's adversarial-prober output stream.
 *
 * The shape, pacing, and mix of this replay deliberately mirrors what we expect
 * from the real BB orchestration. When the real wire lands, this file becomes
 * a fallback used only in browser dev.
 *
 * STUB STATUS:
 *   ☑ Generates a believable probe distribution — clusters of detected bias
 *     near sex×income and race×income axis intersections.
 *   ☐ Replace with deterministic fixture file (probes_replay.json) once we
 *     have a real BB session capture to anchor the demo.
 */

import type { Probe, ProbeStreamEvent } from '@/types/probes'
import type { OrchestrationConfig } from './backboard'
import clustersSeed from '@/seed/probe-clusters.json'
import labelsSeed from '@/seed/probe-labels.json'

type ProtectedAttr = 'sex' | 'race' | 'age'

interface ClusterSeed {
  x: number
  y: number
  attr: ProtectedAttr
  severity: number
  label?: string
}

const BIAS_CLUSTERS: ClusterSeed[] = clustersSeed.clusters as ClusterSeed[]
const LABEL_SAMPLES: Record<ProtectedAttr, string[]> = {
  sex:  labelsSeed.sex,
  race: labelsSeed.race,
  age:  labelsSeed.age,
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function jitter(center: number, spread: number): number {
  return Math.max(-1, Math.min(1, center + (Math.random() - 0.5) * spread))
}

let probeCounter = 0
function nextProbeId(): string {
  probeCounter += 1
  return `probe-${probeCounter.toString(36).padStart(6, '0')}`
}

function makeBaselineProbe(): Probe {
  return {
    id: nextProbeId(),
    x: rand(-1, 1),
    y: rand(-1, 1),
    z: rand(0, 0.2),
    status: 'baseline',
  }
}

function makeDetectedProbe(): Probe {
  const cluster = BIAS_CLUSTERS[Math.floor(Math.random() * BIAS_CLUSTERS.length)]
  return {
    id: nextProbeId(),
    x: jitter(cluster.x, 0.18),
    y: jitter(cluster.y, 0.18),
    z: cluster.severity * 0.9 + Math.random() * 0.1,
    status: 'detected',
    protectedAttribute: cluster.attr,
    confidence: cluster.severity * 0.85 + Math.random() * 0.15,
    label: synthLabel(cluster.attr),
  }
}

function synthLabel(attr: ProtectedAttr): string {
  const opts = LABEL_SAMPLES[attr]
  return opts[Math.floor(Math.random() * opts.length)]
}

/**
 * Replay loop. Streams probe events in roughly the cadence we expect from
 * a live BB session. Returns a stop function.
 */
export function replayProbeFixture(
  config: OrchestrationConfig,
  emit: (event: ProbeStreamEvent) => void,
): () => void {
  let step = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = () => {
    if (stopped) return

    const probe = Math.random() < 0.32 ? makeDetectedProbe() : makeBaselineProbe()
    const focusMatches =
      config.focus === 'all' ||
      probe.protectedAttribute == null ||
      probe.protectedAttribute === config.focus

    if (focusMatches) {
      emit({
        step: ++step,
        probe,
        caption: probe.status === 'detected' ? captionForDetection(probe) : undefined,
      })
    }

    const intervalMs = 1000 / Math.max(0.5, config.rate)
    timer = setTimeout(tick, intervalMs + (Math.random() - 0.5) * 80)
  }

  tick()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

function captionForDetection(probe: Probe): string {
  const conf = Math.round((probe.confidence ?? 0) * 100)
  const attr = probe.protectedAttribute ?? 'a protected attribute'
  return `Probe flagged: prediction shifts ${conf}% when ${attr} alone changes. Sample: ${probe.label}.`
}

/**
 * Splice replay: simulates the user dragging a region. Probes inside the region
 * transition to status='spliced' and their z dampens.
 */
export function spliceFixtureRegion(
  _region: { x0: number; x1: number; y0: number; y1: number },
  _spliceId: string,
  _emit: (event: ProbeStreamEvent) => void,
): Probe[] {
  // STUB: real impl iterates current probe state, finds those in region,
  // emits 'spliced' transition events for each. The graphical fade-out then
  // happens in ProbeField via React state diffing.
  return []
}
