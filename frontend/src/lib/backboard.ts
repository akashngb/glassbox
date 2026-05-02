/**
 * Backboard.io client wrapper.
 *
 * Exposes the multi-agent adversarial-prober orchestration as a typed event stream.
 * Real BB connection happens through pywebview's bridge → Python backboard SDK.
 * When unavailable (browser dev, BB API key absent), falls back to proberAgent's
 * fixture replay which mimics the real stream's pacing and shape.
 *
 * STUB STATUS:
 *   ☑ Type contract defined — matches BB's session/event model.
 *   ☐ Real BB SDK wire — needs BACKBOARD_API_KEY env + glassbox/backboard.py module.
 *   ☐ Multi-jurisdiction RAG — narrator agent should cite GDPR/CCPA/NYC-LL144 based
 *     on detected probe locale; corpus loading is TODO in Python side.
 *
 * Wiring:
 *   1. python: pip install backboard-sdk
 *   2. glassbox/backboard.py: instantiate BB client, register prober/evaluator/detector/narrator agents
 *   3. expose start_orchestration() and on_probe_event(callback) on GlassboxAPI
 *   4. this file calls window.pywebview.api.start_orchestration() on mount,
 *      receives probe events through the existing js_api callback channel
 */

import type { Probe, ProbeStreamEvent } from '@/types/probes'

export interface OrchestrationConfig {
  /** Narrows probe generation to a protected axis. 'all' is the demo default. */
  focus: 'sex' | 'race' | 'age' | 'all'
  /** Cap on concurrent probes. Default tracks --probe-density CSS var. */
  maxProbes: number
  /** Throttle for the prober agent (probes-per-second). */
  rate: number
}

export type ProbeEventListener = (event: ProbeStreamEvent) => void

class BackboardClient {
  private listeners = new Set<ProbeEventListener>()
  private running = false
  private fixtureStream: ReturnType<typeof setTimeout> | null = null

  /**
   * Subscribe to probe events. Returns an unsubscribe function.
   */
  subscribe(listener: ProbeEventListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Start the orchestration session. Real BB call when available, otherwise
   * triggers proberAgent fixture replay.
   */
  async start(config: OrchestrationConfig): Promise<void> {
    if (this.running) return
    this.running = true

    // STUB: real path
    // if (window.pywebview?.api && import.meta.env.VITE_BACKBOARD_LIVE === 'true') {
    //   await window.pywebview.api.start_orchestration(config)
    //   return  // events arrive via Python → JS bridge callback
    // }

    // Fallback: replay fixtures locally
    const { replayProbeFixture } = await import('./proberAgent')
    replayProbeFixture(config, (event) => this.emit(event))
  }

  stop(): void {
    this.running = false
    if (this.fixtureStream) {
      clearTimeout(this.fixtureStream)
      this.fixtureStream = null
    }
    // STUB: window.pywebview?.api.stop_orchestration?.()
  }

  /**
   * User splices a region of the probe field. Real BB path: post the splice
   * back to the orchestration so future probes in this region inherit the
   * spliced outcome. Stub: emits a synthetic 'spliced' event for each probe
   * in the region.
   */
  async splice(region: { x0: number; x1: number; y0: number; y1: number }, spliceId: string): Promise<Probe[]> {
    // STUB: window.pywebview?.api.apply_splice_to_region(region, spliceId)
    const { spliceFixtureRegion } = await import('./proberAgent')
    return spliceFixtureRegion(region, spliceId, (event) => this.emit(event))
  }

  private emit(event: ProbeStreamEvent): void {
    this.listeners.forEach(l => l(event))
  }
}

export const backboard = new BackboardClient()
