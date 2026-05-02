/**
 * Probe field state — keyed by probe id.
 *
 * Updates flow from the Backboard event stream into this store, then components
 * subscribe via useProbes(). This is intentionally separate from the main
 * Glassbox reducer because the probe stream is high-frequency (10-30 events/s)
 * and we want to avoid re-rendering the dashboard panels every tick.
 */
import { useEffect, useState } from 'react'
import type { Probe, ProbeStreamEvent } from '@/types/probes'
import { backboard, type OrchestrationConfig } from '@/lib/backboard'

const DEFAULT_CONFIG: OrchestrationConfig = {
  focus: 'all',
  maxProbes: 220,
  rate: 14,
}

class ProbeStore {
  private probes = new Map<string, Probe>()
  private listeners = new Set<() => void>()
  private latestCaption: string | null = null

  ingest(event: ProbeStreamEvent): void {
    this.probes.set(event.probe.id, event.probe)
    if (event.caption) this.latestCaption = event.caption
    this.notify()
  }

  list(): Probe[] {
    return Array.from(this.probes.values())
  }

  caption(): string | null {
    return this.latestCaption
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(l => l())
  }
}

const store = new ProbeStore()

let started = false
function ensureStarted(config: OrchestrationConfig = DEFAULT_CONFIG): () => void {
  if (started) return () => {}
  started = true
  const unsub = backboard.subscribe(e => store.ingest(e))
  backboard.start(config)
  return () => {
    unsub()
    backboard.stop()
    started = false
  }
}

export function useProbes(): { probes: Probe[]; caption: string | null } {
  const [, setTick] = useState(0)
  useEffect(() => {
    const stop = ensureStarted()
    const unsub = store.subscribe(() => setTick(t => t + 1))
    return () => { unsub(); stop() }
  }, [])
  return { probes: store.list(), caption: store.caption() }
}
