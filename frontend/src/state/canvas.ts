import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type CardKind =
  | 'datapoint'
  | 'protected'
  | 'proxy'
  | 'param-group'
  | 'slider'
  | 'diff'

type Lifecycle = {
  appearAtMs: number      // ms after mount the card pops onto the canvas
  loadDurationMs: number  // how long the skeleton spinner shows after appearing
  visible: boolean        // becomes true at appearAtMs
  loading: boolean        // false after appearAtMs + loadDurationMs
}

export type CardBase = {
  id: string
  kind: CardKind
  x: number
  y: number
  z: number
} & Lifecycle

export type DatapointCard = CardBase & {
  kind: 'datapoint'
  label: string
  features: { key: string; value: string }[]
  trueLabel: 0 | 1
  predicted: 0 | 1
  group: string
}

export type ProtectedCard = CardBase & {
  kind: 'protected'
  attr: string
  groups: { name: string; share: number; positiveRate: number }[]
}

export type ProxyCard = CardBase & {
  kind: 'proxy'
  feature: string
  protectedAttr: string
  correlation: number
  shapImportance: number
}

export type ParamGroupCard = CardBase & {
  kind: 'param-group'
  groupId: 'reg' | 'cw' | 'preproc' | 'sisa' | 'unlearn' | 'features'
  groupName: string
  source: string                                      // file:line for the eyebrow
  palette: 'gold' | 'amber' | 'blue' | 'pink' | 'violet' | 'red'
  params: { key: string; value: string }[]
  trashImpact: { dp: number; eod: number; acc: number }   // applied on delete
}

export type SliderCard = CardBase & {
  kind: 'slider'
  groupName: string                  // header title
  source: string                     // file:line shown in eyebrow
  palette: 'blue'
  paramKey: string                   // e.g., "C", "decision_threshold"
  description: string                // 1–2 sentence hint under the slider
  min: number
  max: number
  step: number
  value: number
  baseline: number                   // value used in training; delta = 0 when value == baseline
  scale: 'linear' | 'log'            // log uses log10(value) - log10(baseline) for delta
  format: 'int' | 'fixed2' | 'fixed3'
  // Linear coefficients applied to (scaled value - scaled baseline).
  dpPerUnit: number
  eodPerUnit: number
  accPerUnit: number
}

export type DiffLine = { kind: 'context' | 'add' | 'del'; text: string }

// Concrete edit pair the Python `apply_diff` API will run against `file`.
// `search` must match the existing source text exactly (whitespace included);
// the API replaces only the first occurrence to keep re-applies idempotent-ish.
export type DiffEdit = { search: string; replace: string }

export type DiffCard = CardBase & {
  kind: 'diff'
  file: string
  hunkHeader: string
  summary: string
  hunks: DiffLine[]
  edits: DiffEdit[]                  // applied to disk on Accept
  rationale: string
  expectedDpDelta: number
  expectedAccDelta: number
  status: 'pending' | 'accepted' | 'rejected'
  error?: string                     // populated by Workspace if apply_diff fails
  moreInfoUrl: string
}

export type Card =
  | DatapointCard
  | ProtectedCard
  | ProxyCard
  | ParamGroupCard
  | SliderCard
  | DiffCard

export type BiasReading = {
  t: number
  dp: number
  eod: number
  acc: number
}

const BASELINE: BiasReading = { t: 0, dp: 0.39, eod: 0.42, acc: 0.682 }

// Deterministic effect of a slider's current value relative to its baseline.
// Returns the bias deltas that *should* be applied (not the change since last tick).
export function sliderEffect(card: SliderCard): { dp: number; eod: number; acc: number } {
  const ref  = card.scale === 'log' ? Math.log10(Math.max(card.baseline, 1e-6)) : card.baseline
  const cur  = card.scale === 'log' ? Math.log10(Math.max(card.value,    1e-6)) : card.value
  const d = cur - ref
  return {
    dp:  d * card.dpPerUnit,
    eod: d * card.eodPerUnit,
    acc: d * card.accPerUnit,
  }
}

// Distributed Omit so each branch of the Card union keeps its discriminating
// properties (a plain Omit collapses the union to its common keys only).
type CardSeed = Card extends infer C ? (C extends Card ? Omit<C, keyof Lifecycle> : never) : never

// ── Hardcoded COMPAS scenario ──────────────────────────────────────────────────
// Numbers come from compas_model.py + the ProPublica two-year recidivism analysis.
// Layout: four loose lanes (datapoints / param-groups / diffs / sliders+proxy)
// at fixed x-bases with ±16px stagger so the canvas feels organized but not gridded.
const _initialCardSeeds: CardSeed[] = [
  // ── Datapoints + protected attribute (left edge) ─────────────────────────────
  {
    id: 'dp-1', kind: 'datapoint', x: 40, y: 60, z: 1,
    label: 'sample · idx 0142',
    features: [
      { key: 'age',           value: '34' },
      { key: 'priors_count',  value: '2' },
      { key: 'c_charge_deg',  value: 'F' },
      { key: 'sex',           value: 'Male' },
      { key: 'race',          value: 'African-American' },
    ],
    trueLabel: 0, predicted: 1, group: 'African-American',
  },
  {
    id: 'dp-2', kind: 'datapoint', x: 56, y: 296, z: 2,
    label: 'sample · idx 0871',
    features: [
      { key: 'age',           value: '52' },
      { key: 'priors_count',  value: '0' },
      { key: 'c_charge_deg',  value: 'M' },
      { key: 'sex',           value: 'Male' },
      { key: 'race',          value: 'Caucasian' },
    ],
    trueLabel: 1, predicted: 0, group: 'Caucasian',
  },
  {
    id: 'prot-race', kind: 'protected', x: 40, y: 540, z: 3,
    attr: 'race',
    groups: [
      { name: 'African-American', share: 0.51, positiveRate: 0.632 },
      { name: 'Caucasian',        share: 0.34, positiveRate: 0.311 },
      { name: 'Hispanic',         share: 0.09, positiveRate: 0.298 },
      { name: 'Other',            share: 0.04, positiveRate: 0.231 },
      { name: 'Asian',            share: 0.01, positiveRate: 0.000 },
      { name: 'Native American',  share: 0.01, positiveRate: 0.000 },
    ],
  },

  // ── Param GROUPS (drag-to-trash impacts) — middle-left, x-jittered ──────────
  {
    id: 'pg-features', kind: 'param-group', x: 308, y: 72, z: 4,
    groupId: 'features',
    groupName: 'Protected features used',
    source: 'compas_model.py:30',
    palette: 'gold',
    params: [
      { key: 'race',           value: 'included · 6 levels' },
      { key: 'sex',            value: 'included · binary' },
      { key: 'age_cat',        value: 'included · 3 buckets' },
      { key: 'c_charge_deg',   value: 'included · F/M' },
    ],
    trashImpact: { dp: -0.18, eod: -0.16, acc: -0.04 },
  },
  {
    id: 'pg-cw', kind: 'param-group', x: 320, y: 348, z: 5,
    groupId: 'cw',
    groupName: 'Class balance',
    source: 'sisa.py:84 (LogReg)',
    palette: 'gold',
    params: [
      { key: 'class_weight[0]', value: '1.0  (no recid)' },
      { key: 'class_weight[1]', value: '1.0  (recid)' },
      { key: 'sampling',        value: 'none' },
    ],
    trashImpact: { dp: -0.06, eod: -0.05, acc: -0.01 },
  },
  {
    id: 'pg-unlearn', kind: 'param-group', x: 304, y: 624, z: 6,
    groupId: 'unlearn',
    groupName: 'Unlearning policy',
    source: 'sisa.py:22',
    palette: 'gold',
    params: [
      { key: 'CANDIDATE_SCORE',  value: '0.75' },
      { key: 'MAX_UNLEARN_PCT',  value: '0.05' },
      { key: 'SEVERITY_CAP',     value: '"HIGH"' },
    ],
    trashImpact: { dp: -0.10, eod: -0.08, acc: -0.02 },
  },
  {
    id: 'pg-reg', kind: 'param-group', x: 316, y: 900, z: 7,
    groupId: 'reg',
    groupName: 'Regularization',
    source: 'sisa.py:84 (LogReg)',
    palette: 'gold',
    params: [
      { key: 'C',         value: '1.0' },
      { key: 'penalty',   value: '"l2"' },
      { key: 'solver',    value: '"lbfgs"' },
      { key: 'max_iter',  value: '200' },
    ],
    trashImpact: { dp: 0.02, eod: 0.02, acc: 0.01 },
  },

  // ── SISA agent diff cards ──────────────────────────────────────────────────
  // Each card mirrors what `retune.py` would write back into `sisa.py` given
  // the bias_report.json flags. `edits[*]` are exact search/replace strings
  // the Python `apply_diff` API runs against the file when Accept is clicked.
  {
    id: 'diff-unlearning-policy', kind: 'diff', x: 612, y: 60, z: 8,
    file: 'sisa.py',
    hunkHeader: '@@ -48,3 +48,3 @@  # Unlearn candidate selection',
    summary: 'Loosen unlearn floor + raise cap',
    hunks: [
      { kind: 'context', text: '# Unlearn candidate selection' },
      { kind: 'del',     text: 'CANDIDATE_SCORE = 0.75   # min model confidence to flag a sample as a candidate' },
      { kind: 'add',     text: 'CANDIDATE_SCORE = 0.65   # widen pool by 0.10 (DPD/DIR pull)' },
      { kind: 'del',     text: 'MAX_UNLEARN_PCT = 0.05   # cap unlearning at 5% of training set per attribute' },
      { kind: 'add',     text: 'MAX_UNLEARN_PCT = 0.075  # +2.5pp severity bonus per HIGH flag' },
    ],
    edits: [
      {
        search:
          'CANDIDATE_SCORE = 0.75   # min model confidence to flag a sample as a candidate',
        replace:
          'CANDIDATE_SCORE = 0.65   # widen pool by 0.10 (DPD/DIR pull)',
      },
      {
        search:
          'MAX_UNLEARN_PCT = 0.05   # cap unlearning at 5% of training set per attribute',
        replace:
          'MAX_UNLEARN_PCT = 0.075  # +2.5pp severity bonus per HIGH flag',
      },
    ],
    rationale:
      'retune.predict_candidate_score: DPD/DIR violations mean P(ŷ=1|priv) is too high, ' +
      'so we lower the confidence floor and raise the unlearn cap by the severity bonus.',
    expectedDpDelta:  -0.07, expectedAccDelta: -0.004,
    status: 'pending',
    moreInfoUrl: '/backboard_demo.html',
  },
  {
    id: 'diff-model-weights', kind: 'diff', x: 624, y: 412, z: 9,
    file: 'sisa.py',
    hunkHeader: '@@ -159,4 +159,4 @@  def _train_shard(self, i, from_slice=0)',
    summary: 'Tighten L2 + balanced class weights',
    hunks: [
      { kind: 'context', text: '    def _train_shard(self, i: int, from_slice: int = 0) -> LogisticRegression:' },
      { kind: 'context', text: '        slices = self.slice_indices[i]' },
      { kind: 'context', text: '        if from_slice == 0:' },
      { kind: 'del',     text: '            model = LogisticRegression(max_iter=1000, warm_start=True, random_state=RANDOM_STATE)' },
      { kind: 'add',     text: "            model = LogisticRegression(max_iter=1000, C=0.1, class_weight='balanced', warm_start=True, random_state=RANDOM_STATE)" },
      { kind: 'context', text: '        else:' },
    ],
    edits: [
      {
        search:
          'LogisticRegression(max_iter=1000, warm_start=True, random_state=RANDOM_STATE)',
        replace:
          "LogisticRegression(max_iter=1000, C=0.1, class_weight='balanced', warm_start=True, random_state=RANDOM_STATE)",
      },
    ],
    rationale:
      "retune.predict_C → 0.1 when any HIGH flag is present; predict_class_weight → 'balanced' " +
      'whenever any flag is present. Both reduce the shard model\'s reliance on group-correlated features.',
    expectedDpDelta:  -0.09, expectedAccDelta: -0.006,
    status: 'pending',
    moreInfoUrl: '/backboard_demo.html',
  },
  {
    id: 'diff-shards-proxy', kind: 'diff', x: 608, y: 760, z: 10,
    file: 'sisa.py',
    hunkHeader: '@@ -36,4 +36,4 @@  # Config',
    summary: 'More SISA shards (cheaper unlearns)',
    hunks: [
      { kind: 'context', text: 'DATASET_PATH    = "compas-scores-raw.csv"' },
      { kind: 'del',     text: 'S               = 5       # SISA shards' },
      { kind: 'add',     text: 'S               = 8       # SISA shards (cheaper future unlearns)' },
      { kind: 'context', text: 'R               = 5       # SISA slices per shard' },
      { kind: 'context', text: 'MODELS_DIR      = "models"' },
    ],
    edits: [
      {
        search: 'S               = 5       # SISA shards',
        replace: 'S               = 8       # SISA shards (cheaper future unlearns)',
      },
    ],
    rationale:
      'retune.predict_S: when n_candidates > 50, increase to 8 shards. Each unlearn ' +
      'operation then touches fewer slice checkpoints and costs less to retrain.',
    expectedDpDelta:  -0.04, expectedAccDelta: -0.002,
    status: 'pending',
    moreInfoUrl: '/backboard_demo.html',
  },
  {
    id: 'proxy-zip', kind: 'proxy', x: 1036, y: 644, z: 11,
    feature: 'zip_code', protectedAttr: 'race',
    correlation: 0.73, shapImportance: 0.21,
  },

  // ── Live-tunable hyperparameter sliders (right column, x-staggered) ──────────
  // All four cards mutate the bias meter as the user drags. Coefficients are
  // hand-tuned approximations of how each knob shifts DP/EOD/Acc on COMPAS.
  {
    id: 'sl-C', kind: 'slider', x: 1032, y: 76, z: 12,
    groupName: 'L2 inverse strength',
    source: 'sisa.py:84 (LogReg)',
    palette: 'blue',
    paramKey: 'C',
    description:
      'Inverse L2 regularization. Lower C → stronger regularization, narrower DP/EOD ' +
      'gaps but a small accuracy cost. Log-spaced.',
    min: 0.01, max: 10.0, step: 0.01, value: 1.0, baseline: 1.0,
    scale: 'log', format: 'fixed2',
    dpPerUnit:  0.05,   // per log10 unit (going from 1.0→0.1 ⇒ ΔDP ≈ −0.05)
    eodPerUnit: 0.04,
    accPerUnit: 0.005,  // raising C slightly improves acc until overfit kicks in
  },
  {
    id: 'sl-thr', kind: 'slider', x: 1044, y: 360, z: 13,
    groupName: 'Decision threshold',
    source: 'compas_model.py:54',
    palette: 'blue',
    paramKey: 'decision_threshold',
    description:
      'Probability cutoff for ŷ=1. Lowering it grants more positives to every group, ' +
      'but disparities in base rate widen the DP gap.',
    min: 0.30, max: 0.70, step: 0.01, value: 0.50, baseline: 0.50,
    scale: 'linear', format: 'fixed2',
    dpPerUnit: -0.45,    // raising threshold narrows DP
    eodPerUnit: -0.40,
    accPerUnit: -0.05,   // small acc trade either direction; modeled as small linear
  },
  {
    id: 'sl-pw', kind: 'slider', x: 1048, y: 856, z: 14,
    groupName: 'Positive class weight',
    source: 'sisa.py:84 (LogReg)',
    palette: 'blue',
    paramKey: 'class_weight[1]',
    description:
      'Sample weight on the recidivism class. Higher values pull more positives ' +
      'from under-represented groups, shrinking EOD at the cost of overall accuracy.',
    min: 0.5, max: 3.0, step: 0.05, value: 1.0, baseline: 1.0,
    scale: 'linear', format: 'fixed2',
    dpPerUnit:  -0.04,
    eodPerUnit: -0.06,
    accPerUnit: -0.02,
  },
  {
    id: 'sl-mi', kind: 'slider', x: 1032, y: 1140, z: 15,
    groupName: 'Solver iterations',
    source: 'sisa.py:84 (LogReg)',
    palette: 'blue',
    paramKey: 'max_iter',
    description:
      'L-BFGS iteration cap. Below ~200 the optimizer underfits and bias swings ' +
      'are noisy; above, gains diminish quickly.',
    min: 50, max: 1000, step: 50, value: 200, baseline: 200,
    scale: 'linear', format: 'int',
    dpPerUnit:  0.00005,   // fully-converged model picks up group signal slightly more
    eodPerUnit: 0.00005,
    accPerUnit: 0.00003,
  },
]

// Per-kind appear timing. Param groups land first; everything else filters in
// over the next ~12 seconds so the canvas isn't overwhelming on launch.
const KIND_TIMING: Record<CardKind, { appearAtMs: number; jitterMs: number; loadDurationMs: number }> = {
  'param-group': { appearAtMs:   400, jitterMs: 500, loadDurationMs: 1400 },
  slider:        { appearAtMs:  2600, jitterMs: 450, loadDurationMs: 1300 },
  protected:     { appearAtMs:  4500, jitterMs:   0, loadDurationMs: 1600 },
  datapoint:     { appearAtMs:  6500, jitterMs: 700, loadDurationMs: 1500 },
  proxy:         { appearAtMs:  9000, jitterMs:   0, loadDurationMs: 1500 },
  diff:          { appearAtMs: 11500, jitterMs: 900, loadDurationMs: 1700 },
}

function seedToCard(seed: CardSeed, kindIdx: number): Card {
  const t = KIND_TIMING[seed.kind]
  return {
    ...seed,
    appearAtMs: t.appearAtMs + kindIdx * t.jitterMs,
    loadDurationMs: t.loadDurationMs + (Math.random() * 400 - 200),
    visible: false,
    loading: true,
  } as Card
}

function buildInitialCards(): Card[] {
  const counters: Partial<Record<CardKind, number>> = {}
  return _initialCardSeeds.map(seed => {
    const idx = counters[seed.kind] ?? 0
    counters[seed.kind] = idx + 1
    return seedToCard(seed, idx)
  })
}

const Z_TOP_START = 100
const HISTORY_CAP = 50

type UndoAction =
  | { type: 'delete';       card: Card }
  | { type: 'accept-diff';  cardId: string }
  | { type: 'reject-diff';  cardId: string }

export function useCanvas() {
  const [cards, setCards] = useState<Card[]>(() => buildInitialCards())
  const [series, setSeries] = useState<BiasReading[]>([BASELINE])
  const zCounter = useRef(Z_TOP_START)
  const tStart = useRef(performance.now())
  const past = useRef<UndoAction[]>([])
  const future = useRef<UndoAction[]>([])
  const [historyVer, setHistoryVer] = useState(0)
  const bumpHistory = () => setHistoryVer(v => v + 1)

  // Mirror of `cards` read synchronously by deleteCard / undo / redo.
  // setState updaters are async, so reading `removed` from inside them
  // gave us undefined — undo lost trash actions because recordAction
  // was reached with a still-undefined `removed` and bailed out.
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  // Drive the appear/loading lifecycle with a single rAF loop.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const now = performance.now() - tStart.current
      let changed = false
      setCards(cs => {
        const next = cs.map(c => {
          let updated = c
          if (!c.visible && now >= c.appearAtMs) {
            updated = { ...updated, visible: true }
            changed = true
          }
          if (updated.loading && now >= c.appearAtMs + c.loadDurationMs) {
            updated = { ...updated, loading: false }
            changed = true
          }
          return updated
        })
        return changed ? next : cs
      })
      // Stop the loop once everything is loaded.
      const allLoaded = !changed && cards.every(c => c.visible && !c.loading)
      if (!allLoaded) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // We deliberately don't depend on `cards` — the rAF loop reads fresh state via setCards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const moveCard = useCallback((id: string, x: number, y: number) => {
    setCards(cs => cs.map(c => (c.id === id ? { ...c, x, y } : c)))
  }, [])

  const bringToFront = useCallback((id: string) => {
    zCounter.current += 1
    const z = zCounter.current
    setCards(cs => cs.map(c => (c.id === id ? { ...c, z } : c)))
  }, [])

  const pushReading = useCallback((dpDelta: number, eodDelta: number, accDelta: number) => {
    setSeries(prev => {
      const last = prev[prev.length - 1] ?? BASELINE
      const next: BiasReading = {
        t: performance.now() - tStart.current,
        dp:  clamp(last.dp + dpDelta,  0,    1),
        eod: clamp(last.eod + eodDelta, 0,   1),
        acc: clamp(last.acc + accDelta, 0.5, 1),
      }
      const out = [...prev, next]
      return out.length > 80 ? out.slice(out.length - 80) : out
    })
  }, [])

  // Update a slider's value and push the marginal bias delta from this change.
  // We diff the slider's effect *before* and *after* the new value so dragging
  // back to baseline cleanly cancels prior deltas without bookkeeping.
  const setSliderValue = useCallback((id: string, value: number) => {
    let dpDelta = 0, eodDelta = 0, accDelta = 0
    setCards(cs =>
      cs.map(c => {
        if (c.id !== id || c.kind !== 'slider') return c
        const oldEff = sliderEffect(c)
        const updated: SliderCard = { ...c, value }
        const newEff = sliderEffect(updated)
        dpDelta  = newEff.dp  - oldEff.dp
        eodDelta = newEff.eod - oldEff.eod
        accDelta = newEff.acc - oldEff.acc
        return updated
      }),
    )
    if (dpDelta !== 0 || eodDelta !== 0 || accDelta !== 0) {
      queueMicrotask(() => pushReading(dpDelta, eodDelta, accDelta))
    }
  }, [pushReading])

  const recordAction = (action: UndoAction) => {
    past.current.push(action)
    if (past.current.length > HISTORY_CAP) past.current.shift()
    future.current = []
    bumpHistory()
  }

  const deleteCard = useCallback((id: string) => {
    const removed = cardsRef.current.find(c => c.id === id)
    if (!removed) return
    setCards(cs => cs.filter(c => c.id !== id))
    if (removed.kind === 'param-group') {
      const i = removed.trashImpact
      queueMicrotask(() => pushReading(i.dp, i.eod, i.acc))
    }
    recordAction({ type: 'delete', card: removed })
  }, [pushReading])

  const acceptDiff = useCallback((id: string) => {
    setCards(cs =>
      cs.map(c => (c.id === id && c.kind === 'diff'
        ? { ...c, status: 'accepted', error: undefined }
        : c)),
    )
    recordAction({ type: 'accept-diff', cardId: id })
  }, [])

  const rejectDiff = useCallback((id: string) => {
    setCards(cs =>
      cs.map(c => (c.id === id && c.kind === 'diff'
        ? { ...c, status: 'rejected', error: undefined }
        : c)),
    )
    recordAction({ type: 'reject-diff', cardId: id })
  }, [])

  // Set/clear an inline error on a diff card (used when apply_diff fails).
  const setDiffError = useCallback((id: string, error: string | undefined) => {
    setCards(cs =>
      cs.map(c => (c.id === id && c.kind === 'diff' ? { ...c, error } : c)),
    )
  }, [])

  const applyAction = (action: UndoAction, direction: 'do' | 'undo') => {
    switch (action.type) {
      case 'delete': {
        if (direction === 'do') {
          setCards(cs => cs.filter(c => c.id !== action.card.id))
          if (action.card.kind === 'param-group') {
            const i = action.card.trashImpact
            pushReading(i.dp, i.eod, i.acc)
          }
        } else {
          setCards(cs => [...cs, action.card])
          if (action.card.kind === 'param-group') {
            const i = action.card.trashImpact
            pushReading(-i.dp, -i.eod, -i.acc)
          }
        }
        break
      }
      case 'accept-diff': {
        const next = direction === 'do' ? 'accepted' : 'pending'
        setCards(cs => cs.map(c => (c.id === action.cardId && c.kind === 'diff' ? { ...c, status: next } : c)))
        // Diff effect on the bias chart is invisible to the meter at undo time
        // (apply during 'do'/redo only, mirror on undo).
        const target = cardsRef.current.find(c => c.id === action.cardId)
        if (target && target.kind === 'diff') {
          if (direction === 'do') pushReading(target.expectedDpDelta, target.expectedDpDelta * 0.85, target.expectedAccDelta)
          else                    pushReading(-target.expectedDpDelta, -target.expectedDpDelta * 0.85, -target.expectedAccDelta)
        }
        break
      }
      case 'reject-diff': {
        const next = direction === 'do' ? 'rejected' : 'pending'
        setCards(cs => cs.map(c => (c.id === action.cardId && c.kind === 'diff' ? { ...c, status: next } : c)))
        break
      }
    }
  }

  const undo = useCallback(() => {
    const action = past.current.pop()
    if (!action) return
    applyAction(action, 'undo')
    future.current.push(action)
    bumpHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, pushReading])

  const redo = useCallback(() => {
    const action = future.current.pop()
    if (!action) return
    applyAction(action, 'do')
    past.current.push(action)
    bumpHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, pushReading])

  const canUndo = past.current.length > 0
  const canRedo = future.current.length > 0

  const latest = series[series.length - 1] ?? BASELINE

  return useMemo(
    () => ({
      cards, series, latest,
      moveCard, bringToFront, deleteCard, pushReading,
      acceptDiff, rejectDiff, setSliderValue, setDiffError,
      undo, redo, canUndo, canRedo,
    }),
    // historyVer triggers re-derivation of canUndo/canRedo since they read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cards, series, latest,
      moveCard, bringToFront, deleteCard, pushReading,
      acceptDiff, rejectDiff, setSliderValue, setDiffError, undo, redo, historyVer,
    ],
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
