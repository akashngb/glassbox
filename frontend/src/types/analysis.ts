/**
 * Analysis types. Mirrored on the Python side in glassbox/api.py.
 *
 * An Analysis is a full snapshot of the model's bias state on the held-out test
 * set after some sequence of splices has been applied. The frontend does not
 * mutate Analysis values; the reducer only ever swaps one for another.
 */

export type PanelId = 'dpd' | 'dir' | 'eod' | 'accuracy' | 'flags'

export type CaptionFraming = 'accept' | 'reject' | 'committed'

export type SplicePrimitive =
  | 'unlearn'
  | 'reweight'
  | 'smote'
  | 'threshold'
  | 'fairlearn'

export interface Splice {
  id: string
  kind: SplicePrimitive
  label: string
  primitive: SplicePrimitive
  magnitude: number  // 0..1, affects how aggressive the tray card looks
  args: Record<string, string | number>
}

export type SpliceCatalog = Splice[]

export interface PanelHistoryPoint {
  /** Index in the timeline this measurement came from. */
  step: number
  value: number
}

export interface DPDPanel {
  /** Demographic parity difference: P(ŷ=1|priv) − P(ŷ=1|unpriv). */
  value: number
  history: PanelHistoryPoint[]
}

export interface DIRPanel {
  /** Disparate impact ratio: P(ŷ=1|unpriv) / P(ŷ=1|priv). The 80% rule. */
  value: number
  history: PanelHistoryPoint[]
}

export interface EODPanel {
  /** Equal opportunity difference: TPR(priv) − TPR(unpriv). */
  value: number
  history: PanelHistoryPoint[]
}

export interface AccuracyPanel {
  privileged: number
  unprivileged: number
  history: PanelHistoryPoint[]
}

export interface BiasFlag {
  attribute: string
  metric: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  value: number
  threshold: number
  message: string
}

export interface AnalysisPanels {
  dpd: DPDPanel
  dir: DIRPanel
  eod: EODPanel
  accuracy: AccuracyPanel
  flags: BiasFlag[]
}

export interface Analysis {
  /** Stable id for fixture routing. */
  id: string
  /** Top-line caption. Each panel renders its own consequence caption separately. */
  caption: string
  panels: AnalysisPanels
}
