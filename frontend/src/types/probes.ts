/**
 * Probe types — adversarial bias-discovery via Backboard multi-agent orchestration.
 *
 * Each probe is one synthetic counterfactual input that the prober agent generates,
 * the evaluator runs through the model, and the detector classifies for bias risk.
 * Visible as one particle in ProbeField.tsx.
 *
 * Wiring: real probes arrive via lib/backboard.ts when the BB client is configured.
 * Otherwise lib/proberAgent.ts replays a fixture stream for the demo.
 */

export type ProbeStatus =
  | 'baseline'      // freshly generated, drifting
  | 'evaluating'    // model inference in flight
  | 'detected'      // detector flagged: prediction depends on protected attr
  | 'spliced'       // user splice covered this probe — outcome shifted

export interface Probe {
  id: string

  /** Position in normalized world space, [-1, 1] on x/y. The z-axis encodes
      severity of the bias detection (higher = more severe). */
  x: number
  y: number
  z: number

  status: ProbeStatus

  /** When detected, which protected attribute drove the flag.
   *  'age' is continuous; threshold splices need it as their operand. */
  protectedAttribute?: 'sex' | 'race' | 'age' | null

  /** Detector's confidence in the bias flag (0..1). Mapped to particle glow. */
  confidence?: number

  /** When spliced, which splice ID was applied to this probe's region. */
  splicedBy?: string

  /** Semantic label from the prober — e.g. "white male, 45, doctorate, 60h/week".
      Used in the InspectorRail when the user hovers a detected probe. */
  label?: string
}

export interface ProbeRegion {
  /** Normalized bounding box in world space. */
  x0: number; x1: number
  y0: number; y1: number
}

export interface ProbeStreamEvent {
  /** Monotonically increasing event index from the orchestration session. */
  step: number
  /** What changed in this tick — a single probe state transition. */
  probe: Probe
  /** Optional narrator caption attached to the transition. */
  caption?: string
}
