# Glassbox Implementation Plan — synthesis of 4 lane specs

Reads: `system.md` (409L), `components.md` (486L), `interactive.md` (439L), `drag-drop.md` (555L). This doc consolidates cross-lane decisions, resolves conflicts, sequences the work, and surfaces risks. Lane specs are canonical for their own scope; this plan is canonical when lanes disagree.

Scope: 36-hour hackathon, Kelly solo on frontend. Demo target: 90 seconds, WKWebView 1280×820, fixtures only (real BB wire-up is phase 3).

---

## 1. Cross-lane convergences (no debate needed)

| Decision | Source | Note |
|---|---|---|
| Token-first via `@theme` in `globals.css` | all 4 lanes | Every value referenced by a CSS var. JS reads via `lib/tokens.ts`, never writes. |
| Owner split: GSAP (discrete edges) / useFrame (continuous field) / motion (DOM springs) | system §6, interactive §5, drag-drop §7.2 | Never share tweens across owners. |
| Drop-to-stage, not drop-to-commit | drag-drop §6.1, system §1 (`splice-pending` state) | Release → `stage()` → InspectorRail accept/Enter = real commit. |
| Reduced-motion: explicit per-edge degradation, not just CSS blanket | system §5, components, interactive §7, drag-drop §8 | One shared `useReducedMotion` hook in `lib/`. |
| Pywebview cursor: standard CSS only (`crosshair`/`grabbing`/`not-allowed`) | drag-drop §4.1 | No SVG cursors — known WKWebView gaps. |
| Per-probe-mesh through phase 1; no instancing yet | interactive §6 | 220 probes is below the 500-probe threshold. |

---

## 2. Cross-lane conflicts and resolutions

### 2.1 Probe density: 220 vs 120

- **system §7.6**: drop to ~120 for demo legibility, fade field opacity to 0.55 during pending.
- **interactive §6**: 220 is fine performance-wise.

**Resolution:** system wins on demo grounds. Default `--probe-density: 120` for the demo build, with a `--probe-density-rich: 220` token kept for post-demo. Field opacity drop during `splice-pending` is also adopted.

### 2.2 MorphSVG plugin

- **components §3.2**: hand-author 5 family glyphs as MorphSVG-style components.
- **system §6.1**: register MorphSVGPlugin defensively, license caveat.
- **interactive §5**: "Don't pull MorphSVGPlugin... Core GSAP only."

**Resolution:** no MorphSVGPlugin. Hand-author 5 glyphs as `motion.path` components with paired idle/preview `d` attributes. Identical point counts so motion's spring interpolation works without a plugin. AnimatePresence crossfade is the fallback if a pair drifts.

### 2.3 Probe pulse cadence

- **interactive §2 (pulse)**: current `useFrame` math gives ~2.9s period; `--probe-pulse-ms: 1200` is **not honored**.
- **system §4.2**: assumes the token works.

**Resolution:** interactive is right. Stage 1 fixes the pulse equation: `phase = elapsed * (2π / (pulseMs / 1000))` reading the CSS var via `tokens.ts`. Validate one probe pulses at 1.2s after fix.

### 2.4 Threshold splice has no operand

- **drag-drop §3.3**: threshold needs a continuous attribute; `protectedAttribute: 'sex' | 'race'` rejects it.
- **components §3** lists threshold without addressing the type.

**Resolution:** widen `Probe.protectedAttribute` to `'sex' | 'race' | 'age'`. Add 5 age-axis labels to `seed/probe-labels.json`. Add 1 age-axis cluster to `seed/probe-clusters.json` so threshold has somewhere to land in the demo. Backboard contract: real prober output already includes continuous attributes; this is forward-compatible.

### 2.5 z-index ordering

- **drag-drop §4**: field z-0, overlay z-1, panels z-2.
- **interactive §3.4 (open question 4)**: cluster halo wants z-3 above panels.

**Resolution:** add z-3 layer for cluster halos and probe captions, both `pointer-events: none`. Final order:

| Layer | z-index | Pointer events |
|---|---|---|
| ProbeField (WebGL canvas) | 0 | none |
| Gesture overlay | 1 | auto, only over field rect (excluding tray/inspector/timeline regions) |
| Bento panels + tray + inspector + timeline | 2 | auto |
| Cluster halos + probe captions + drag tooltip | 3 | none |
| Drag rectangle + trailing line | 3 | none (rectangle uses pointer-events: none; gestures captured at z-1) |

### 2.6 Hover tooltips during drag

- **interactive §4**: hover tooltip on detected/spliced probes via 28px screen radius nearest-pick.
- **drag-drop §7.2**: probe color migration "drag wins"; tooltip behavior unspecified during drag.

**Resolution:** suppress hover tooltip during any non-`idle` drag phase (`arming` / `selecting` / `carrying` / `committing`). Also suppress cluster-halo proximity affordance during the same phases (drag-drop §4.2 already implies this).

### 2.7 Probe-outside opacity

Both lanes want darker outside-region probes during interactions, but state machines differ.

| State | Outside opacity | Source |
|---|---|---|
| `selecting` / `carrying` | 0.85 → 0.55 | drag-drop §2.2 |
| `splice-pending` | 0.92 → field-wide opacity drop (panels above stay legible) | system §3.3 |

**Resolution:** no conflict. Keep both. `--probe-outside-opacity: 0.55` is drag-only. Field-wide pending dampening uses `--probe-glow-pending` (already in system spec).

---

## 3. Consolidated token additions

Single edit to `frontend/src/styles/globals.css` `@theme` block. Total: ~70 new tokens. Order them by group, comment each group.

```css
@theme {
  /* === durations === */
  --dur-instant: 80ms;
  --dur-quick:   180ms;
  --dur-base:    320ms;
  --dur-event:   620ms;
  --dur-boot:    1100ms;
  --dur-scrub:   500ms;

  /* === easing curves (GSAP names mirror in CSS) === */
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:      cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);
  --ease-settle:  cubic-bezier(0.20, 0.80, 0.30, 1.05);
  --ease-dampen:  cubic-bezier(0.4, 0, 0.6, 1);

  /* === motion springs === */
  --motion-stiff:        280;
  --motion-damp:          22;
  --motion-stiff-soft:   180;
  --motion-damp-soft:     26;
  --motion-stiff-snap:   380;
  --motion-damp-snap:     18;

  /* === stagger === */
  --stagger-panel:    60ms;
  --stagger-tray:     40ms;
  --stagger-caption:  12ms;
  --stagger-timeline: 28ms;

  /* === field choreography === */
  --probe-density:           120;     /* demo default; rich mode 220 */
  --probe-density-rich:      220;
  --probe-glow-watching:    0.35;
  --probe-glow-probing:     0.55;
  --probe-glow-pending:     0.25;
  --probe-glow-flash:       0.85;
  --probe-dampen-factor:    0.40;
  --probe-flash-ms:          240;
  --probe-recover-ms:        520;
  --probe-outside-opacity:  0.55;

  /* === slide offsets === */
  --slide-inspector: 24px;
  --slide-panel:     12px;
  --slide-tline:     16px;

  /* === glass system === */
  --gb-glass-blur:        14px;
  --gb-glass-saturate:    140%;
  --gb-glass-tint:        rgba(22, 25, 31, 0.62);
  --gb-glass-tint-active: rgba(22, 25, 31, 0.72);
  --gb-glass-edge:        rgba(255, 255, 255, 0.05);
  --gb-glass-edge-bright: rgba(255, 184, 107, 0.35);
  --gb-glass-highlight:   linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 22%);
  --gb-glass-shadow:      0 8px 28px -12px rgba(0, 0, 0, 0.55), 0 1px 0 rgba(255,255,255,0.03) inset;
  --gb-glass-refraction:  0 0 0 1px rgba(255, 255, 255, 0.025) inset;

  /* === splice family colors === */
  --gb-family-unlearn:    var(--color-bad);
  --gb-family-reweight:   var(--color-accent);
  --gb-family-smote:      #6bb8ff;
  --gb-family-threshold:  var(--color-warn);
  --gb-family-fairlearn:  var(--color-good);

  /* === type scale === */
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

  /* === status pill === */
  --gb-status-h:          22px;
  --gb-status-pad-x:      10px;
  --gb-status-dot-size:   6px;
  --gb-status-pulse-from: 1;
  --gb-status-pulse-to:   0.65;

  /* === timeline === */
  --gb-timeline-h:           64px;
  --gb-timeline-node-d:      12px;
  --gb-timeline-gap:         24px;
  --gb-timeline-connector-h: 1px;

  /* === splice tile === */
  --gb-tile-glyph-size:   24px;

  /* === drag gesture === */
  --drag-arm-distance:    6px;
  --drag-min-area:        0.0036;
  --drag-max-area:        2.56;
  --drag-min-probes:      3;
  --region-shadow-lift:   0 4px 16px rgba(0, 0, 0, 0.4);
  --drag-trail-opacity:   0.35;
  --drag-trail-fade-px:   200;

  /* === drop target === */
  --drop-hit-radius:        64px;
  --drop-magnet-distance:   32px;
  --drop-magnet-strength:   0.5;
  --tile-active-border:     1px solid var(--color-fg-subtle);
  --tile-receptive-border:  2px solid var(--color-accent);
  --tile-reject-border:     1px solid var(--color-bad);
  --tile-shake-amplitude:   4px;

  /* === cluster affordance === */
  --cluster-detect-radius:  0.15;
  --cluster-min-probes:     3;
  --cluster-bright-factor:  1.1;
  --cluster-throttle-ms:    67;

  /* === forecast === */
  --forecast-opacity:       0.4;
  --forecast-orbit-radius:  0.02;
  --forecast-spawn-spread:  0.05;

  /* === keyboard fallback === */
  --keyboard-focus-outline: 2px solid var(--color-accent);
}
```

---

## 4. Implementation sequence

7 stages. Each stage is one or more commits. Stage exit criteria are explicit so you know when to move on.

### Stage 0 — preconditions (~30 min)

| Step | Surface | Done when |
|---|---|---|
| Verify deps installed | `frontend/package.json` | three, @react-three/fiber, @react-three/drei, gsap all present (just installed). `npm run build` succeeds. |
| **Smoke-test backdrop-filter in pywebview** | one throwaway div with blur(8px) | Renders blurred over the probe field; no flicker. If it fails, the entire glass system falls back to solid `--color-surface`; same token names, no component changes. |
| Add `useReducedMotion` hook | `frontend/src/lib/useReducedMotion.ts` | Returns live boolean from `matchMedia('(prefers-reduced-motion: reduce)')`. Replaces ad-hoc check in ProbeField. |
| Clean up root npm pollution | `/Users/kelly/glassbox/{package.json, package-lock.json, node_modules}` | Removed (Task #14). |

### Stage 1 — foundation (~90 min)

| Step | Surface | Done when |
|---|---|---|
| Consolidated token patch | `globals.css` `@theme` | All ~70 tokens from §3 above in one block, grouped + commented. |
| `lib/tokens.ts` | new | Reads CSS vars at mount, exports typed numbers (durations as ms, eases as cubic-bezier strings, springs as objects). CSS is SoT; JS reads only. |
| `lib/gsapInit.ts` | new | Registers Observer + CustomEase. Defines named eases: `settle`, `dampen`. Imported once from `main.tsx`. No MorphSVG. |
| Widen `Probe.protectedAttribute` | `types/probes.ts` | `'sex' \| 'race' \| 'age'`. |
| Fix probe pulse to honor token | `particles/ProbeField.tsx` | `phase = elapsed * (2π / (pulseMs / 1000))`. Verify visually: detected probe pulses at 1.2s. |
| Add 1 age cluster + 5 age labels | `seed/probe-clusters.json`, `seed/probe-labels.json` | Threshold splice has somewhere to land. |
| Suppress hover/cluster affordance during drag | shared drag state in `state/glassbox.ts` | `dragPhase` field added; tooltip + cluster halo gate on `dragPhase === 'idle'`. |

### Stage 2 — glass identity (~90 min)

| Step | Surface | Done when |
|---|---|---|
| `GlassSurface` component | `components/GlassSurface.tsx` | `as` polymorphic, `intensity: 'base'\|'raised'\|'sunken'\|'active'`. Wraps content. |
| `gb-glass` utility class | `globals.css` | Composable on any element. Variants for `raised`/`sunken`/`active` set token overrides. |
| Reskin Panel | `components/Panel.tsx` | Uses GlassSurface intensity `base`. Pending state flips to `active`. |
| Reskin SpliceTray tile chrome | `components/SpliceTray.tsx` | Tiles use intensity `raised`. |
| Reskin Inspector chrome | `components/InspectorRail.tsx` | Intensity `sunken`. |
| Reskin Timeline strip | `components/Timeline.tsx` | Intensity `raised`, 50% tint, 8px blur. |
| Reskin CommandBar | `components/CommandBar.tsx` | Full-width strip, intensity `active`-like, 60% tint, 12px blur. |

Exit: visual smoke in pywebview. Glass reads against the field. No frame drops below 50fps with all surfaces glass'd.

### Stage 3 — component primitives (~120 min)

Per components.md Appendix B priority. Each is independent; pause and ship Stage 2 + Stage 1 if time runs short.

1. `Caption` with `framing: 'accept' | 'reject' | 'committed'` (~20 min). Locks consequence-framed second-person voice.
2. `MetricReadout` with `format`, `delta`, `unit` (~30 min). Mono number flips inline inside sans prose.
3. `SpliceTile` extracted from `SpliceTray.button` (~45 min). Includes 5 hand-authored family glyphs as `motion.path` components in `components/icons/`.
4. `StatusPill` with state prop (~20 min).
5. `ProbeCaptionCard` (~30 min). Anchored bottom-left of BentoCanvas, max 3 visible, LIFO replace.
6. `TimelineNode` extraction + hover-card (~30 min).

Defer: `BiasFlagRow`, `InspectorKVRow`, `ModelOutputCard`, `EmptyState`, `LoadingShimmer`, auto-scroll teaser. All low-priority refactors.

### Stage 4 — motion choreography (~90 min)

| Step | Surface | Done when |
|---|---|---|
| `<SceneRoot>` + boot timeline | `components/SceneRoot.tsx`, wired into `App.tsx` | One-shot GSAP timeline runs once on mount. Body fade → BentoCanvas fade → panel stagger → ProbeField density ramp → Timeline + CommandBar. Killed in cleanup; never replays. Gated on `await document.fonts.ready` with 400ms timeout (system §7.7). |
| State edges for `pending` / `applied` / `rejected` | `state/glassbox.ts` consumers | Each panel data-state attr drives the choreography per system §4. Atomicity: kill running tweens by ID before firing new edge. |
| Field follower rules | `particles/ProbeField.tsx` (or new `FieldScene.tsx`) | During `splice-pending`: drift × 0.4, glow → `--probe-glow-pending`. During `applied`: flash to `--probe-glow-flash`, settle. During `rejected`: lift dampening only, no flash. |
| Inspector slide-in | `components/InspectorRail.tsx` | Motion spring `--motion-stiff-soft` / `--motion-damp-soft`. Caption word-stagger. |

### Stage 5 — interactive lane (~90 min)

| Step | Surface | Done when |
|---|---|---|
| `useFrame` consolidation | `particles/ProbeField.tsx` → `FieldScene.tsx` | One parent useFrame iterates all probes via `meshes.current` Map. Per-probe components keep their refs but no longer hold useFrame. |
| Cursor → field spotlight + soft attraction | `FieldScene.tsx` | Read cursor world position from a ref. Spotlight radius 0.55 (brightness boost). Attraction radius 0.30 (baseline probes only, max offset 0.04). Detected probes do NOT move. |
| Probe lifecycle `evaluating → detected` overshoot | per-probe GSAP timeline | `back.out(1.7)` overshoot, 520ms. Ring expansion sprite 0 → 0.08 world, fade. |
| `detected → spliced` 3-phase choreography | per-probe GSAP timeline | 200ms flare → 280ms paint flip (stillness held) → 320ms settle. Position locked through paint flip. |
| Cluster halo + pulse echoes + caption tether | overlay div at z-3 | Halo on cluster centroid (4 probes within 0.22 radius), 720ms expand, persists 2400ms, dampens on cursor enter or splice. Max 1 visible at a time. |
| Hover tooltip on detected/spliced | overlay div at z-3 | 28px screen radius nearest-pick, 12px offset toward more-room side, hysteresis 36px. Suppressed during drag phases. |

### Stage 6 — drag-drop polish (~60 min)

| Step | Surface | Done when |
|---|---|---|
| Add `arming` phase | `particles/SpliceGesture.tsx` | 6px / 300ms threshold before rectangle renders. Click without drag = silent no-op. |
| Region label (probe count) | SpliceGesture | Mono count tag at rectangle's top-right corner. Updates on pointermove. |
| `carrying` phase | SpliceGesture | On pointer-out of field rect with button down: rectangle lifts (translateY -2px + shadow), trailing line cursor → region center. |
| Drop-target tile states | `components/SpliceTile.tsx` | `idle` / `drag-active` / `receptive` / `reject` per drag-drop §3.1. |
| Magnetic snap | SpliceGesture + tile hit-test | 32px from tile center, 0.5 strength bias on cursor's logical position. |
| Per-tile attribute compatibility | SpliceGesture commit logic | Per drag-drop §3.3 table. Inspect probe attrs in region; threshold needs `'age'` dominant. |
| Cmd-Z keyboard undo | App-level keybinding | Dispatches `scrub` to previous head. Cmd-Shift-Z for redo. No-op at baseline. |
| Forecast preview | FieldScene + drag state | Ship `unlearn` (probes inside fade to 30%) + `reweight` (faint orbit dots) only. Drop the rest. |

### Stage 7 — calibration + smoke (~60 min)

| Step | Done when |
|---|---|
| Demo path walk-through | 90-second arc lands: boot → 2 detected clusters form → drag region → drop on tile → accept → settle. |
| Probe density tune | If 120 reads sparse, bump to 150. If panels lose focus, drop to 100. |
| Voice/copy lint | grep for forbidden words: "we noticed", "potential", "may be", "delve", em dashes. |
| Reduced-motion check | Toggle macOS reduced-motion. Verify static SVG fallback, no GSAP timelines fire, captions still appear. |
| Performance smoke | DevTools Performance tab during demo: useFrame < 4ms/frame, render commits < 30/sec. |

---

## 5. Top risks (highest first)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | `backdrop-filter` blur drops to 20fps in pywebview WKWebView | High | Smoke-test in Stage 0 before Stage 2 even starts. Token-driven fallback path: solid `--color-surface`, identical token names, no component changes. |
| 2 | GSAP `force3D` interacts badly with pywebview compositing | Medium | If boot timeline janks, set `gsap.config({ force3D: false })` in `gsapInit.ts`. |
| 3 | useFrame and GSAP both write to same THREE properties on same frame | Medium | Per-mesh `transitionInProgress` ref gates useFrame writes during GSAP tweens. |
| 4 | MorphSVG license blocks demo | n/a | Avoided. No MorphSVGPlugin. Hand-authored glyphs with `motion.path`. |
| 5 | Threshold splice has no operand if `protectedAttribute` stays binary | High | Stage 1 widens to include `'age'` and adds 1 age cluster + 5 labels. |
| 6 | 220 probes loses panel focus during demo | Medium | Default `--probe-density: 120`. Calibrate at T-1h. |
| 7 | Drop-to-stage requires 2 clicks per splice (drop + accept). 90s demo could feel slow. | Medium | Rehearse the arc. If tight, fall back to drop-to-commit on Cmd-held drop only; default stays drop-to-stage. |
| 8 | macOS pinch-to-zoom in WKWebView could stretch field mid-drag | Low | Set `zoomable=False` on pywebview window create. |
| 9 | Choreography registry (`lib/choreography.ts`) is overspec for 36h | Low | Ship without it. Use named tween IDs as documentation; `gsap.killTweensOf(target)` per-element runtime. Refactor in if time. |
| 10 | Auto-scroll Timeline teaser fights ProbeField visually | Low | Default OFF. Enable only if review says timeline reads as static. |

---

## 6. What this plan does NOT include

- Real Backboard wire-up (phase 3, post-demo).
- VS Code extension (resolved: pywebview only).
- SISA wire-up to GlassboxAPI (Task #6, deferred).
- Branchable timeline (drag-drop §6 phase 3).
- ModelOutputCard (data layer doesn't carry sample IDs).
- Auto-scroll teaser on Timeline.
- Forecast previews for `smote` / `threshold` / `constraint`.
- Full keyboard splice path beyond Cmd-Z. Spec exists in drag-drop §8.2; ship only if Stage 6 finishes early.

---

## 7. Demo script outline (for calibration reference)

90 seconds, narration cadence:

```
0:00–0:15  Boot. Field ramps in, panels stagger, fairness metrics paint baseline.
0:15–0:25  ProberAgent flags first cluster (sex × income). Caption appears bottom-left.
           Panel border outlines red. Field pulses at cluster.
0:25–0:35  Kelly drags a region around the cluster. Region label "27 probes".
           Carrying phase: rectangle lifts, trail line.
0:35–0:42  Drops on Reweight tile. Tile flashes accept. Ghost overlay draws
           on bias panels. Inspector slides in.
0:42–0:55  Inspector shows consequence caption + accept/reject. Kelly hits Enter.
           Field flashes. Spliced probes go amber. Timeline gains a node.
0:55–1:10  Second cluster fires (race × occupation). Repeat with Unlearn.
1:10–1:25  Cmd-Z scrubs back. Watch the wave morph in reverse. Cmd-Shift-Z restores.
1:25–1:30  Ending tableau: settled state, two splices on timeline, captions readable.
```

If this arc isn't legible by Stage 7 calibration, drop the second splice and slow the first.
