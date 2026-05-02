# Glassbox — components spec

Lane: reusable visual primitives. Sits *above* the ProbeField particle layer, *below* the dashboard layout. This doc is design intent, not implementation. Token spine is `frontend/src/styles/globals.css`. Where a token does not yet exist, this doc proposes it under "token deps (proposed)".

Reading prerequisite: `huskyhack-2026/DESIGN.md` §Frontend system architecture, §5 Component architecture.

---

## 1. Component inventory

Every primitive that lives under the dashboard chrome. Existing means present in `frontend/src/components/`. Missing means proposed by this spec.

| Primitive | Status | Purpose | Props sketch | States | Token deps |
|---|---|---|---|---|---|
| `Panel` | existing | Bento cell. Holds title, unit, big metric, subline, child wave, optional caption slot. | `id, title, unit?, metric, subline?, children` | idle, hover, selected, pending (data-state), committed-pulse, disabled-during-scrub | `--color-surface, --color-border, --radius-panel, --color-pending, --color-accent-soft, --gb-glass-blur, --gb-glass-tint` |
| `GlassSurface` | missing | The shared chrome under every panel/card/tray-tile. Backdrop-filter + 1px refraction edge + inner highlight. Wraps content. | `as?, intensity?, edge?, children` | base, raised, sunken, active | `--gb-glass-blur, --gb-glass-tint, --gb-glass-edge, --gb-glass-highlight, --gb-glass-shadow` |
| `Wave` | existing | Two-layered SVG path: baseline + ghost. The morph primitive. | `baseline, ghost?, width?, height?` | static, ghost-drawing, ghost-settled | `--color-baseline, --color-pending, --motion-stiff, --motion-damp` |
| `SpliceTile` | missing (split out of `SpliceTray.button`) | One transformation card in the tray. Icon glyph, label, primitive tag, magnitude, drag handle. | `splice, isPending, onStage, onPreviewEnter, onPreviewLeave` | idle, hover-preview, dragging, staged, disabled | `--color-elevated, --color-border, --color-pending, --radius-tray, --gb-tile-glyph-size, --probe-spliced` |
| `PrimitiveBadge` | missing | Tiny pill marking which of the 5 splice families a tile belongs to. | `kind: SplicePrimitive` | static (one per kind) | `--color-fg-muted, --radius-pill`, family-color tokens (proposed below) |
| `MagnitudeBar` | existing (inline) | 1px-tall bar showing how aggressive a splice is. Promote to its own file. | `value: 0..1` | static | `--color-border, --color-accent` |
| `MetricReadout` | missing | Mono number + unit label + delta arrow. Used in Panel header and Inspector. | `value, format, delta?, unit` | idle, ghost-target (showing what value would become), increased, decreased | `--font-mono, --color-fg, --color-fg-muted, --color-good, --color-bad, --gb-num-size-lg, --gb-num-size-md` |
| `CommandPill` | missing | The chip-shaped suggestion below the CommandBar input. Stitch-style preset prompts. | `label, onClick` | idle, hover, pressed, dismissing | `--color-elevated, --color-border, --color-accent-soft, --radius-pill` |
| `KbdHint` | existing (inline in CommandBar) | The `⏎` key affordance. Promote. | `keys: string[]` | static | `--color-border, --font-mono` |
| `ProbeCaptionCard` | missing | Caption that surfaces when a probe flags. Consequence-framed second-person. Auto-dismiss. | `id, text, severity, onDismiss, lifespanMs?` | entering, visible, lingering, dismissing | `--gb-glass-blur, --color-pending, --probe-detected, --gb-caption-max-w` |
| `StatusPill` | missing | The probe-state badge. baseline/detected/spliced/settled/drifting. | `state: ProbeState, count?, animated?` | each state | `--probe-baseline, --probe-evaluating, --probe-detected, --probe-spliced, --color-good (=settled), --color-warn (=drifting), --radius-pill` |
| `BiasFlagRow` | existing (inline in BentoCanvas) | One row in the flags panel. Severity dot + message. Promote. | `flag: BiasFlag` | low, medium, high, hover | `--color-bad, --color-warn, --color-fg-subtle, --color-fg-muted` |
| `TimelineNode` | existing (inline in Timeline) | One commit dot with label. Promote and extend with hover-detail. | `node, isHead, isPending, onScrub` | idle, head, pending, hover-card-open, scrubbing | `--color-fg-muted, --color-pending, --color-accent, --radius-pill` |
| `TimelineRow` | missing (wraps Timeline) | The 64px strip itself. Scrolls horizontally. Plays the LYRwgPo seamless-loop pattern when idle. | `nodes, head, pending, onScrub` | idle (auto-scroll teaser), interactive (paused), scrubbing | `--gb-timeline-h, --color-border, --gb-glass-blur` |
| `InspectorKVRow` | missing | Two-column key/value row for Inspector detail (group, attribute, threshold, etc.). | `k, v, mono?` | idle, ghost-delta (showing what would change) | `--color-fg-muted, --color-fg, --font-mono` |
| `AcceptRejectGroup` | missing (inline in InspectorRail) | The two-button commit affordance. Single component so motion/keyboard binding lives in one place. | `onAccept, onReject, busy?` | idle, busy (during fixture lookup), success-flash, error | `--color-accent, --color-accent-strong, --color-bg, --color-border` |
| `ModelOutputCard` | missing | Small card showing a sample model output (image thumb, label, predicted vs. true). Used in Inspector when a flag is for a specific instance. | `sample, predicted, actual, confidence` | correct, incorrect, ghost-corrected | `--color-elevated, --color-border, --radius-tray, --color-good, --color-bad` |
| `Caption` | missing (inline in Inspector) | Paragraph component for consequence captions. Enforces voice rules (max-line, type scale, framing). | `text, framing` | accept-tense, reject-tense, committed-tense | `--font-sans, --gb-caption-line-h, --gb-caption-max-w, --color-fg, --color-fg-muted` |
| `UnitLabel` | existing (`.gb-unit-label` class) | All-caps mono micro-label. | `children` | static | `--color-fg-muted, --font-mono` |
| `SectionHeader` | missing | Tray section header ("UNLEARN", "REWEIGHT"). Currently inlined in `SpliceTray`. | `label` | static | same as `UnitLabel` |
| `EmptyState` | missing | Inspector idle copy slot. | `headline, hint?` | idle | `--color-fg-subtle, --gb-caption-max-w` |
| `LoadingShimmer` | missing | Shown when a fixture is in flight (cheap, demo never blocks long). | `lines?, w?` | shimmering | `--color-elevated, --color-border, motion vars` |

Total: 21 primitives. 7 existing (loose), 14 to extract or compose.

Hackathon prioritization: extract `SpliceTile`, `MetricReadout`, `ProbeCaptionCard`, `StatusPill`, `TimelineNode`, `Caption` first. The rest are ergonomic refactors of existing inline JSX.

---

## 2. Glass aesthetic spec

The product is named Glassbox. The chrome must read as glass at every scale. Concept-image reference (`concept-images/`) is acrylic blocks with caustic refraction; `ui-ref/original-3db2bf8e49b0f1d33fd4381a5b3d65d8.webp` is the closest dashboard analog. We are not chasing translucent skeumorphism, we are chasing one specific cue: **the panel surface samples color from the particle field behind it**.

### 2.1 Tokens (proposed)

Extend `@theme` in `globals.css`:

```
--gb-glass-blur:        14px;     /* backdrop-filter blur strength */
--gb-glass-saturate:    140%;     /* slight color punch on whatever sits behind */
--gb-glass-tint:        rgba(22, 25, 31, 0.62);   /* surface base, scaled-back from --color-surface */
--gb-glass-tint-active: rgba(22, 25, 31, 0.72);   /* hovered/selected: more body */
--gb-glass-edge:        rgba(255, 255, 255, 0.05); /* 1px inner hairline */
--gb-glass-edge-bright: rgba(255, 184, 107, 0.35); /* accent edge for pending state */
--gb-glass-highlight:   linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 22%);
--gb-glass-shadow:      0 8px 28px -12px rgba(0, 0, 0, 0.55), 0 1px 0 rgba(255,255,255,0.03) inset;
--gb-glass-refraction:  0 0 0 1px rgba(255, 255, 255, 0.025) inset;
```

### 2.2 The `gb-glass` utility

```
.gb-glass {
  background: var(--gb-glass-tint);
  backdrop-filter: blur(var(--gb-glass-blur)) saturate(var(--gb-glass-saturate));
  -webkit-backdrop-filter: blur(var(--gb-glass-blur)) saturate(var(--gb-glass-saturate));
  border: 1px solid var(--color-border);
  box-shadow: var(--gb-glass-shadow), var(--gb-glass-refraction);
  position: relative;
}
.gb-glass::before {
  /* top-edge highlight, the cue that says "this has thickness" */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--gb-glass-highlight);
  pointer-events: none;
}
```

`gb-panel` should compose `gb-glass`. Same for tray tiles, command bar, inspector chrome, timeline strip.

### 2.3 Interaction with the ProbeField

The particle field is `gb-probe-field` at `z-index: 0`, panels at `z-index: 2`. Today panels are opaque (`--color-surface` solid). The glass treatment changes the contract:

| Where | Treatment |
|---|---|
| Panel face | 62% opaque tint + 14px blur. Probes behind a panel become a soft color wash, never resolvable as individual particles. The panel reads dark, not transparent. |
| Panel edge (1px) | 1px solid `--color-border`, plus an inset 1px `--gb-glass-edge` hairline at the top quarter. This is the refraction cue, not a glow. |
| Pending panel | edge swaps to `--gb-glass-edge-bright`, blur drops to 10px so probe motion is *slightly* more legible inside the bias panel. The user is being told: this region is where the action is. |
| Detected panel (probe flagged this metric) | A 6px `--probe-detected` halo bleeds in from the edge for one pulse cycle (`--probe-pulse-ms`), then settles back to standard chrome. Particle-color sampling stays. |
| Inspector rail | full glass at 72% tint (more body, less particle bleed). It is the read surface, not the hot zone. |
| Timeline strip | 50% tint, 8px blur. Lower body so the strip feels lighter and more transient than panels. |
| Splice tray tile | 70% tint, 8px blur, smaller `--radius-tray`. Tiles read as pieces of glass you can grab; panels read as glass you look through. |
| Command bar | full-width strip, 60% tint, 12px blur. Sits on top of everything. |

**Frost level mapping** (single dial, makes the glass system consistent):

```
intensity:  base → raised → sunken → active
blur:        14px   10px     16px     10px
tint alpha:  0.62   0.55     0.72     0.72
edge:        edge   edge     edge     edge-bright
```

`raised` = tray tiles (less occluding). `sunken` = inspector body. `active` = pending or selected.

### 2.4 Anti-cues

Skip any of:
- multi-stop conic-gradient borders (Linear/Vercel hover-glow). Reads as web SaaS, not native ML tool.
- chromatic aberration / RGB split on edges. The concept images show it, but at 1280x820 in pywebview it will look like a font-rendering bug.
- frosted-white default macOS sidebar look. Glassbox is dark-mode-first; frost should read amber-warm against the bg, never neutral.

### 2.5 Verification flag

`backdrop-filter` works in WKWebView on macOS 11+ per MDN compat data. Should also test in the actual pywebview shell: pywebview uses `WKWebView` on macOS but the GPU-acceleration flag has flipped between minor versions. Smoke-test `backdrop-filter: blur(8px)` on a single div before adopting across all panels. If it fails, fallback is solid `--color-surface` with no blur, identical token names, no component changes.

---

## 3. Splice tile spec

The 5 splice primitives are `unlearn | reweight | smote | threshold | fairlearn` (per `frontend/src/types/analysis.ts`). Each tile in the tray is the same shape, differentiated by glyph + family color + magnitude.

### 3.1 Anatomy

```
┌─────────────────────────────────────────────┐  44px tall, --radius-tray
│  [glyph]   Drop residual children gradient  │  ← label, max 2 lines
│   ▓▓▓▓▓                                     │  ← magnitude bar
│  UNLEARN              57%      ⠿            │  ← family pill, mag%, drag handle
└─────────────────────────────────────────────┘
```

- **Glyph** (24px box, top-left): one MorphSVG-compatible icon per family. Stroke-only, 1.5px, `--color-fg-muted` idle, `--color-accent` on hover. Lucide is not installed; either install Lucide React (flag: `would require install of lucide-react`) or hand-author 5 SVG components in `components/icons/`. Recommendation: hand-author. Five icons is faster than installing and tree-shaking, and they need to morph (next subsection).
- **Label**: `--font-sans`, 13px, leading-tight, max 2 lines with `text-overflow: ellipsis`.
- **Magnitude bar**: existing `MagnitudeBar`. 1px tall when idle, 2px on hover. Color shifts from `--color-accent` to `--color-accent-strong` when magnitude > 0.7 (signals "destructive splice").
- **Family pill**: `PrimitiveBadge`. See below.
- **Drag handle**: vertical dots glyph, right-aligned. Visible on hover only, `--color-fg-subtle`.

### 3.2 Family glyphs (MorphSVG candidates)

Each glyph has a paired "preview state" path. Hovering a tile morphs the glyph from idle to preview shape using `motion.path` `d` interpolation. Pattern lifted from `code/pen/WQjRXE.debug.html`. Effect is small but is the "this splice has a verb" cue.

| Family | Idle glyph | Preview-on-hover glyph | Family color |
|---|---|---|---|
| `unlearn` | filled circle with a horizontal line through it | the line lifts off the circle (like a strikethrough peeling away) | `--gb-family-unlearn: #ef4444` (alias `--color-bad`) |
| `reweight` | balance-scale: two squares on a beam, equal | beam tilts, one square enlarges | `--gb-family-reweight: #ffb86b` (alias `--color-accent`) |
| `smote` | three small dots in a triangle | dots fan out into seven (synthetic insertion) | `--gb-family-smote: #6bb8ff` (proposed; cool teal contrast) |
| `threshold` | horizontal line at mid-height with two stacked rectangles | the line slides up, one rectangle shrinks | `--gb-family-threshold: #f59e0b` (alias `--color-warn`) |
| `fairlearn` | a square with a constraint bracket `[ ]` around it | brackets close inward | `--gb-family-fairlearn: #10b981` (alias `--color-good`) |

These five tokens (`--gb-family-*`) live alongside the existing semantic tokens. They're for tile chrome only; never apply to data viz.

### 3.3 States

| State | Treatment |
|---|---|
| idle | base glass-raised, glyph muted, drag handle hidden |
| hover (preview) | tile lifts 1px, glyph morphs to preview, **the BentoCanvas dims to 0.92 opacity** and panels affected by this splice grow a 1px `--gb-glass-edge-bright` outline. No ghost wave yet — we don't burn the reveal on hover, only on stage. |
| dragging | glass-active intensity, glyph stays in preview state, drag handle fully visible, `cursor: grabbing` |
| staged (= `pending.splice.id === splice.id`) | persistent `--color-pending` border, glyph latched in preview state |
| disabled | 50% opacity, no hover, no glyph morph. Used when scrub is mid-flight. |

### 3.4 Hover-preview without committing

The current tray triggers `stage()` on click — it commits to a pending splice immediately. The spec extends this: hovering a tile for >180ms lights the affected panels' edges (no wave change). Pointer-leave clears within 120ms. This makes the tray legible without forcing the user to commit just to see scope.

Implementation note: this is `onPointerEnter` + 180ms timer + `dispatch({kind:'preview', splice})`, plus a new reducer state `previewing` that's mutually exclusive with `pending`. Reducer change is small. If timing slips, ship without preview-on-hover and rely on the post-stage ghost.

---

## 4. Probe caption card

Background: the ProbeField runs an adversarial bias-discovery agent. When a probe flags a region, a caption surfaces. This is a different surface from the InspectorRail consequence caption — Inspector captions are deliberate and persistent, probe captions are ambient and ephemeral.

### 4.1 Where it surfaces

Anchored to the bottom-left corner of the BentoCanvas region (NOT the InspectorRail, which is a deliberate-action surface). Stacks upward, max 3 visible at once, oldest scrolls off-bottom and dismisses.

```
BentoCanvas ─────────────────────────────────┐
                                              │
   panel    panel    panel                    │
   panel    panel    panel                    │
                                              │
   ┌─────────────────────┐                    │
   │ Probe flagged the   │   ← newest         │
   │ age × income gap    │                    │
   └─────────────────────┘                    │
   ┌─────────────────────┐                    │
   │ ...                 │   ← older          │
   └─────────────────────┘                    │
─────────────────────────────────────────────┘
Timeline ─────────────────────────────────────
```

### 4.2 Spec

| Property | Value |
|---|---|
| width | min 280px, max `--gb-caption-max-w` (proposed: 360px) |
| padding | 12px 14px |
| chrome | `gb-glass` at intensity `raised` (10px blur, 0.55 tint), `--radius-tray` |
| accent border | 1px left edge in severity color: `--probe-detected` (high), `--color-warn` (medium), `--probe-evaluating` (low) |
| type | `--font-sans`, 12px, `line-height: 1.45`, `--color-fg` |
| max line count | 3 (CSS `-webkit-line-clamp: 3`) |
| close affordance | none. Auto-dismiss only. (No clicky x; the surface is ambient, not transactional.) |
| lifespan | `--gb-caption-lifespan: 8000ms` default, 12s for severity high. Reduced-motion override: 14s flat. |
| enter | `x: -16, opacity: 0 → x: 0, opacity: 1`, 240ms `--ease-out` |
| linger | from 70% lifespan elapsed, opacity drifts 1 → 0.7, `filter: blur(0) → blur(0.5px)` |
| exit | `opacity → 0, x: -8`, 320ms `--ease-out` |

### 4.3 Voice (consequence-framed second-person)

Per `DESIGN.md` §7. Three forbidden voice tells: "we noticed", "potential bias", "may be". Templates:

- "Your model misclassifies women earning >$50k 2.3x more than men in the same band."
- "23% accuracy gap when subjects are children. Click the tray to splice."
- "Drift is increasing on the age axis. Your last accept made it worse."

### 4.4 Interaction with Inspector

If a probe caption is flagged HIGH severity AND the user clicks it, it promotes to the InspectorRail as a `pending` selection (auto-fills with the suggested splice). Otherwise it just dismisses. This is a stretch, gate behind a `data-promotable="true"` attr.

---

## 5. Status pills / badges

Five canonical states. One component, one prop. Color comes from the probe token block already in `globals.css` plus two new aliases.

### 5.1 States

| State | When | Color | Motion on entry |
|---|---|---|---|
| `baseline` | model loaded, no analysis run yet | `--probe-baseline` (#2c3340) | none |
| `detected` | probe flagged at least one region | `--probe-detected` (#ef4444) | scale 1 → 1.08 → 1, 320ms `--ease-out`, then settle into a 1200ms pulse loop (alpha 1 → 0.65 → 1) until clicked |
| `spliced` | a splice is committed | `--probe-spliced` (#ffb86b) | 1px width grow at left edge, 240ms |
| `settled` | post-splice, all flags cleared | `--color-good` (#10b981) | crossfade from previous color, 480ms |
| `drifting` | drift score increasing across last N steps | `--color-warn` (#f59e0b) | gentle horizontal nudge `x: -1, 1, 0` over 600ms, repeats every 4s |

### 5.2 Anatomy

```
●  detected     ←  6px dot + 11px label, padding 4px 10px, --radius-pill, gb-glass intensity raised
   23           ← optional count, --font-mono
```

Heights lock at 22px. The dot is a `<span>` not a `::before`, so motion props can attach to it (Motion needs a real element).

### 5.3 Token additions (proposed)

```
--gb-status-h:           22px;
--gb-status-pad-x:       10px;
--gb-status-dot-size:    6px;
--gb-status-pulse-from:  1;
--gb-status-pulse-to:    0.65;
```

Color is purely aliased from existing probe + semantic tokens. No new color hex.

---

## 6. Timeline row

The bottom 64px strip. Each row is the *strip itself* (only one). Each *node* in the row is one splice action. Today: nodes are flat dots, no detail on hover, no scrubbing. Spec extends.

### 6.1 Layout

```
[label]   ●─────●─────◐─────●─────●  ─ ─ ◌      ▶
"Timeline"  baseline reweight pending(→) accepted        playhead-cue
```

- Strip height: `--gb-timeline-h: 64px` (proposed).
- Strip chrome: `gb-glass` intensity `raised` (8px blur, 0.50 tint), no rounded corners (full-bleed within its parent grid cell).
- Padding: 12px vertical, 16px horizontal.
- Scroll: horizontal, overflow-x auto. Scroll bar styled `none` (`scrollbar-width: none`); use the LYRwgPo continuous-loop pattern from `code/pen/LYRwgPo.debug.html` only when *idle* (no pending, no scrub) AND timeline length > 5 nodes. The auto-scroll teases the user that there is history to look at; pointer-enter pauses it. Implementation: wrap inner row in a `motion.div` with `animate={{ x: [-0, -nodesWidth] }}` looped, `whileHover={{ animationPlayState: 'paused' }}`. Skip if it competes with the ProbeField for attention; the strip is small so it might just feel busy. Flag for visual review.

### 6.2 Node types

| Variant | Symbol | Treatment |
|---|---|---|
| baseline (root, always first) | filled `--color-baseline` (gray) | small label "baseline", no hover-card |
| accepted | filled `--color-fg-muted`, hover lifts to `--color-accent`, tooltip shows splice label + acceptedAt | clickable, scrubs Canvas back |
| head (current) | filled `--color-accent`, ring of `--color-accent-soft` (8px box-shadow) | non-clickable (already there) |
| pending | half-filled outline in `--color-pending`, dashed connector to its parent | non-clickable, exits via accept/reject |
| branched | accepted node with a small fork glyph (`Y` shape) instead of the dot | branching is a stretch; phase 3 |
| ghost (rejected, faded) | empty outline, 30% opacity | not interactive; visible for 1.5s after a reject then removes |

### 6.3 Hover detail (TimelineNode → hover-card)

Hovering a non-head accepted node opens a 240ms pop-up *above* the strip:

```
┌──────────────────────────────────────┐
│ Reweight age weights (2.4x)          │  ← splice.label (sans, 12px bold)
│ "Closed gap from 23pp to 4pp."       │  ← committed-tense caption
│ acceptedAt 18:42                     │  ← --font-mono, 10px, --color-fg-subtle
└──────────────────────────────────────┘
        ▼  (8px gap)
        ●  (the node)
```

Hover card uses `gb-glass` raised. Auto-dismiss on pointer-leave. Click anywhere on the node (not just the card) scrubs.

### 6.4 Scrub motion

Per `DESIGN.md` §4, scrubbing animates the Canvas back through the morph chain at 1.5x speed. From the Timeline's perspective: the playhead `▶` slides to the target node smoothly (300ms `--ease-out`), then each panel's `Wave` morph is re-played. While scrubbing, the strip dims to 0.7 opacity and disables further hovers.

### 6.5 Token additions (proposed)

```
--gb-timeline-h:        64px;
--gb-timeline-node-d:   12px;        /* node dot diameter */
--gb-timeline-gap:      24px;        /* connector length */
--gb-timeline-connector-h: 1px;
```

---

## 7. Type scale + monospace usage

Two families per `globals.css`: `--font-sans` (Atkinson Hyperlegible) and `--font-mono` (JetBrains Mono). Rule, not a vibe: **mono is for things the user reads as a measurement; sans is for things the user reads as language**.

### 7.1 Where each family fits

| Surface element | Family | Rationale |
|---|---|---|
| Big metric on Panel (28px, in `gb-num`) | mono | It's a number. Tabular alignment matters across panels. |
| Subline on Panel ("ideally 0", "%") | sans | Editorial qualifier. |
| Panel title ("Demographic Parity Diff") | sans bold | Reads as a label/heading. |
| Unit label (`UNIT · PRIVILEGED · UNPRIVILEGED`) | mono uppercase | Categorical micro-label, lo-fi terminal feel. Already encoded in `.gb-unit-label`. |
| Caption body (Inspector, ProbeCaption) | sans | Prose. Atkinson's legibility is the whole point. |
| Caption pull-numbers ("1,200 children", "23pp") | mono inline | Use a `<span class="gb-num">` inside the caption. The number flips families inside the sentence — that's the inferential leap visualized. |
| Splice tile label | sans | Prose, even if short. |
| Splice tile magnitude % | mono | Number. |
| Family pill text ("UNLEARN") | mono uppercase | Categorical. Same treatment as unit label. |
| CommandBar input | sans | User text. |
| CommandBar `glassbox.open(...)` identity strip | mono | Code. |
| CommandPill (suggestion chip) | sans | "rebalance children class to parity" — natural language. |
| Kbd hints (`⏎`, `⌘K`) | mono | Code/symbol. |
| TimelineNode label | sans | Splice name is editorial. |
| TimelineNode acceptedAt | mono | Time. |
| BiasFlag message | sans | Prose. |
| BiasFlag value/threshold | mono | Numbers. |
| Status pill label | sans | Single word. |
| Status pill count | mono | Number. |

### 7.2 Type scale (proposed)

Currently sized inline with arbitrary `text-[12px]`. Lock a small scale and reference it. Add to `@theme`:

```
--gb-text-headline: 28px;   /* the big metric */
--gb-text-body:     13px;   /* default — captions, splice labels, inspector */
--gb-text-meta:     11px;   /* sublines, hover-card details */
--gb-text-micro:    10px;   /* unit labels, magnitude % */
--gb-text-input:    14px;   /* command bar, focused text input */

--gb-leading-tight:   1.25;
--gb-leading-body:    1.45;  /* caption sweet spot for Atkinson at 13px */
--gb-leading-display: 1.0;   /* big number, no descenders to worry about */

--gb-caption-max-w:   58ch;  /* line length for prose. ~58 chars at 13px Atkinson */
--gb-caption-line-h:  1.45;
```

These should replace the inline `text-[Npx]` strings as components are extracted.

### 7.3 Numeric formatting rules

- All percentages: `+23.4pp` style (sign always when negative is meaningful, "pp" suffix mono).
- Ratios (DIR): three decimal places, e.g., `0.732`.
- Counts: thousand-separated with thin space (` `, not comma) at >=10000.
- Use `tabular-nums` everywhere a number changes (already encoded in `.gb-num`).

---

## 8. Open questions / risks

### Open questions

1. **Probe caption max stack count.** Spec says 3. If the proberAgent emits faster than 8s lifespans clear, captions will queue and never settle. Need rate-limit on the agent side, or LIFO-replace policy on the card side. Lean LIFO-replace; ambient surface, not a log.
2. **Lucide vs. hand-authored icons.** Lucide is not installed. Five icons that need to morph favors hand-authored MorphSVG-style components. Confirm before installing `lucide-react`.
3. **`backdrop-filter` perf in pywebview WKWebView.** Layer-count budget is unclear. If we have CommandBar + 5 panels + Inspector + Timeline + 3 ProbeCaptions all with active backdrop-filter, that's 11 simultaneously. Monitor frame rate during demo prep; if it stutters, demote backdrop-filter on tray tiles and timeline (the lowest-importance surfaces).
4. **Hover-preview-without-commit on tray.** Adds a `previewing` reducer state. Do we ship it for T-0 or after?
5. **Auto-scroll teaser on Timeline (LYRwgPo pattern).** Two animated systems competing for attention (probes + auto-scrolling history). High risk of feeling busy. Default OFF; only enable if visual review says the timeline reads as static.
6. **Branchable timeline.** `DESIGN.md` says branches are a primary surface. Spec leaves branching as phase 3. Confirm whether judge demo path needs to show a branch.
7. **ModelOutputCard scope.** Inspector currently has no per-instance view. `BiasFlag` doesn't carry sample IDs. Cutting this primitive unless the data layer changes by T-3h.
8. **Where does the "currently scrubbing" state live?** Reducer needs a `scrubbing: boolean` flag so multiple components can dim/disable. Not currently in `state/glassbox.ts`. Small change.

### Risks (highest first)

| Risk | Severity | Mitigation |
|---|---|---|
| `backdrop-filter` blur drops the panel from 60fps to 20fps in pywebview | High | Smoke-test in pywebview with all surfaces glass'd before T-3h. Fallback path: solid-fill version of every glass token, swap globally with one CSS variable flip. |
| MorphSVG glyphs look wonky during transition (path point counts mismatch) | Medium | Hand-author each pair so source paths have identical point counts. Where they don't, fall back to icon crossfade with `AnimatePresence`. |
| Timeline auto-scroll fights ProbeField visually | Medium | Default OFF as noted. |
| ProbeCaptionCard stack overlaps the bottom-left panel and obscures it | Medium | Anchor cards to the canvas's *padding region* below the bottom panel row, not over panels. If canvas is too tight, dock to the InspectorRail bottom instead. |
| Family glyphs read as decorative, not functional | Low | The glyph morphs on hover. Motion makes it functional. If still decorative, drop it and use a typed letter (`U R S T F`) in mono, family-colored. |
| Frost-amber glass reads jaundiced on the cold-blue MLP-2025 reference | Low | We are not chasing that reference's palette. Confirm with team that warm-amber is the lock. |
| `ConsequenceCaption` voice rules drift across panels | Low | Caption component enforces a `framing` prop; copy lives in fixtures. Lint check (manual) at T-1h: search for forbidden words. |

### Out of scope for this spec (deliberately)

- Particle field internals (different lane).
- Layout / grid (different lane: dashboard).
- Reducer / state shape (different lane: connecting).
- Python boundary.
- Real bias analysis. Phase-1 fixtures only.

---

## Appendix A — Token additions summary

All new tokens proposed by this spec, ready to drop into `@theme`:

```
/* Glass system */
--gb-glass-blur:        14px;
--gb-glass-saturate:    140%;
--gb-glass-tint:        rgba(22, 25, 31, 0.62);
--gb-glass-tint-active: rgba(22, 25, 31, 0.72);
--gb-glass-edge:        rgba(255, 255, 255, 0.05);
--gb-glass-edge-bright: rgba(255, 184, 107, 0.35);
--gb-glass-highlight:   linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 22%);
--gb-glass-shadow:      0 8px 28px -12px rgba(0, 0, 0, 0.55), 0 1px 0 rgba(255,255,255,0.03) inset;
--gb-glass-refraction:  0 0 0 1px rgba(255, 255, 255, 0.025) inset;

/* Splice family colors */
--gb-family-unlearn:    var(--color-bad);
--gb-family-reweight:   var(--color-accent);
--gb-family-smote:      #6bb8ff;
--gb-family-threshold:  var(--color-warn);
--gb-family-fairlearn:  var(--color-good);

/* Type scale */
--gb-text-headline:     28px;
--gb-text-body:         13px;
--gb-text-meta:         11px;
--gb-text-micro:        10px;
--gb-text-input:        14px;
--gb-leading-tight:     1.25;
--gb-leading-body:      1.45;
--gb-leading-display:   1.0;
--gb-caption-max-w:     58ch;
--gb-caption-line-h:    1.45;
--gb-caption-lifespan:  8000ms;

/* Status pill */
--gb-status-h:          22px;
--gb-status-pad-x:      10px;
--gb-status-dot-size:   6px;
--gb-status-pulse-from: 1;
--gb-status-pulse-to:   0.65;

/* Timeline */
--gb-timeline-h:           64px;
--gb-timeline-node-d:      12px;
--gb-timeline-gap:         24px;
--gb-timeline-connector-h: 1px;

/* Tile */
--gb-tile-glyph-size:   24px;
```

## Appendix B — Component extraction priority (hackathon ordering)

1. `GlassSurface` + `gb-glass` utility — unblocks the entire visual identity rewrite. Touch one place, every panel updates. **(60 min)**
2. `Caption` component (with `framing` prop) — locks voice across panels. **(20 min)**
3. `SpliceTile` extracted from `SpliceTray` — brings glyphs and primitive badges. **(45 min)**
4. `MetricReadout` — promotes the inline `<span>` patterns in `BentoCanvas` into a single number surface. Lets us add ghost-target deltas. **(30 min)**
5. `ProbeCaptionCard` — new surface, depends on prober wiring. **(30 min, gated on prober data)**
6. `StatusPill` — consumes existing tokens, fast. **(20 min)**
7. `TimelineNode` extraction + hover card — the polish layer. **(30 min)**
8. Everything else — only if time remains.

Total committed scope ≈ 4 hours. Aligns with Phase 1 window in `DESIGN.md`.
