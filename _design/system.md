# Glassbox System Spec — motion, transitions, choreography

Lane: SYSTEM. This file is the contract for how the whole app moves: page-level transitions, scene state changes, animation tokens, and choreography between the WebGL probe field and the dashboard panels stacked above it.

Out of scope here: panel-internal animation, wave morph internals, individual component variants. Those live in the COMPONENTS lane.

Token-first. No magic numbers in components. Every duration, easing, distance, stagger, and choreography offset resolves to a CSS custom property declared in `globals.css`.

Stack assumptions (verified against `/Users/kelly/glassbox/package.json` 2026-05-02): React 19, `motion` 12 (the renamed Framer Motion package), `gsap` 3.15, `three` 0.184, `@react-three/fiber` 9, `@react-three/drei` 10. WKWebView on macOS. WebGL2 yes, WebGPU no. GSAP is installed but not yet imported anywhere in the source tree.

---

## 1. Scene state machine

The app is a finite state machine over the `pending` and `selection` axes plus a `boot` lifecycle. State transitions drive choreography across three layers simultaneously: probe field, bento panels, timeline cursor.

```
boot ─► watching ◄──► probing ──► splice-pending ──► splice-applied ──► settled ─► watching
                                          │
                                          └── splice-rejected ─► watching
```

| State | Trigger | Probe field | Panels | Timeline | Inspector |
|---|---|---|---|---|---|
| `boot` | App mount | Field is hidden, density 0. Boot timeline ramps `--probe-density` from 0 to 220 over `var(--dur-boot)`. | Panels enter on staggered slide-up (12px, `var(--ease-out)`, `var(--stagger-panel)`). | Hidden, slides up last. | Empty. |
| `watching` | Idle, no pending splice | Drift at `--probe-drift-speed`, baseline color, no pulse. Glow at `--probe-glow-watching` (0.35). | `data-state="idle"`. Hover lifts only. | Cursor blinks at head, no pending node. | Hidden or showing last selection. |
| `probing` | A backboard probe transitions `evaluating` or `detected` | One or more probes pulse at `--probe-pulse-ms`. Glow ramps to `--probe-glow-probing` (0.55) over `--dur-base`. Detected probes' world-space position projects to a panel; that panel's `data-probe="active"` flips on. | One panel borders flash with `--color-pending` for `--dur-event`, then settle to a 1px inner accent ring while probe is active. | Unchanged. | Unchanged. |
| `splice-pending` | User drags a tray item onto canvas, types in command bar, or completes splice gesture | Field dampens: drift speed scales by `--probe-dampen-factor` (0.4), glow drops to `--probe-glow-pending` (0.25), spliced probes shift toward `--probe-spliced` color. | Every panel renders ghost overlay. Inspector slides in from right. | Pending node `◐` appears at cursor with `--ease-settle` arrival. | Slides in over `--dur-base` carrying consequence caption. |
| `splice-applied` | Accept | Field briefly brightens: glow pulses to `--probe-glow-flash` (0.85) then settles back. Spliced probes hold at `--probe-spliced` color for `--dur-event` then migrate to baseline. | Panels run `data-state="committed"` keyframe (existing `gb-pulse`). Ghost paths harden into baseline. | Pending node solidifies `◐ → ●` with `--ease-settle` overshoot. | Caption flips to past-tense framing in place; no slide. |
| `splice-rejected` | Reject | Spliced probes return to baseline color over `--dur-base`. Glow returns to `--probe-glow-watching`. | Ghost paths draw out backwards (`pathLength` 1 → 0). | Pending node fades `◐ → ◌ → gone`. | Inspector slides out by `--dur-base` to right. |
| `settled` | 600ms after `splice-applied`, no further action | Same as `watching` but timeline cursor advances to new head. | Same as `watching`. | New head dot, cursor on top. | Persists or fades per Inspector logic. |

The state machine reads from `useGlassboxState`. The `boot` step is owned by `App.tsx` via a top-level `<SceneRoot>` mount-once timeline. All other states are derived from `pending`, `ghost`, and a new selector `probeStatus = derive(probes)` that returns `'watching' | 'probing'`.

Two rules:

1. **One choreography fires per state edge.** If the user accepts a splice while a probe is mid-pulse, the pulse cancels (kill running tweens by ID) and the accept choreography wins. State edges are atomic.
2. **The probe field is a follower, not a leader, during user-driven edges.** Pending → applied → rejected are user-driven; probing is field-driven. Field choreography never fires while a user-driven choreography is running.

---

## 2. Motion token additions

These extend the existing `@theme` block in `/Users/kelly/glassbox/frontend/src/styles/globals.css`. Existing tokens kept (do not duplicate). Naming: `--motion-*` for stiffness/damping, `--ease-*` for curves, `--dur-*` for durations, `--stagger-*` for orchestration, `--probe-*` for the field. All values justified inline.

```css
@theme {
  /* === durations === */
  --dur-instant: 80ms;     /* hover lift, focus ring, panel border swap */
  --dur-quick:   180ms;    /* small UI moves, caption swap */
  --dur-base:    320ms;    /* canonical state-edge length */
  --dur-event:   620ms;    /* big choreographed edges (splice apply, reject) */
  --dur-boot:    1100ms;   /* one-time boot ramp; only fires on App mount */
  --dur-scrub:   500ms;    /* timeline scrub per node hop */

  /* === easing curves ===
     Names follow GSAP convention so JS-driven tweens stay legible.
     The CSS strings are equivalents; do not edit one without the other. */
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);          /* power3.out */
  --ease-in:      cubic-bezier(0.7, 0, 0.84, 0);          /* power3.in */
  --ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);         /* power2.inOut */
  --ease-settle:  cubic-bezier(0.20, 0.80, 0.30, 1.05);   /* back.out(1.4); slight overshoot for commit */
  --ease-dampen:  cubic-bezier(0.4, 0, 0.6, 1);           /* power1.inOut; field dampening */

  /* === motion physics (motion/react springs) === */
  --motion-stiff:  280;
  --motion-damp:   22;
  --motion-stiff-soft: 180;   /* inspector slide-in */
  --motion-damp-soft:  26;
  --motion-stiff-snap: 380;   /* commit overshoot */
  --motion-damp-snap:  18;

  /* === stagger ===
     Numeric ms; consumed directly by motion's `staggerChildren`
     and gsap's `stagger: { each: ... }`. */
  --stagger-panel:    60ms;   /* bento panel boot reveal */
  --stagger-tray:     40ms;   /* splice tray item entrance */
  --stagger-caption:  12ms;   /* per-word caption trail */
  --stagger-timeline: 28ms;   /* timeline node spawn */

  /* === field choreography ===
     Multipliers and intensity floors driven by state. */
  --probe-glow-watching: 0.35;
  --probe-glow-probing:  0.55;
  --probe-glow-pending:  0.25;
  --probe-glow-flash:    0.85;
  --probe-dampen-factor: 0.40;   /* drift-speed multiplier during pending */
  --probe-flash-ms:      240;    /* accept-flash window */
  --probe-recover-ms:    520;    /* return to watching */

  /* === offsets used in transitions === */
  --slide-inspector: 24px;       /* inspector x-offset for slide-in */
  --slide-panel:     12px;       /* boot reveal y-offset */
  --slide-tline:     16px;       /* timeline boot reveal y-offset */
}
```

Token-to-animation mapping (every value above ties to a specific motion in section 4 or section 3). No token introduced without a use-site.

| Token | Used by |
|---|---|
| `--dur-instant` | `gb-panel:hover` lift; focus ring fade. |
| `--dur-quick` | Inspector caption swap; per-panel `data-probe` flip; pending dot pulse. |
| `--dur-base` | All standard state-edge moves: ghost overlay enter, splice-rejected ghost exit, field dampen ramp. |
| `--dur-event` | Splice-applied flash, probe-flash recovery, accept choreography overall length. |
| `--dur-boot` | Single-shot mount timeline only. Never used at runtime after first paint. |
| `--dur-scrub` | Timeline node-to-node scrub when user clicks history. |
| `--ease-out` | Default for entrances. |
| `--ease-in` | Exits where the user "throws away" something (reject). |
| `--ease-settle` | Commit overshoot on accept; pending node arrival. |
| `--ease-dampen` | Field glow ramp during pending state. |
| `--motion-stiff` / `--motion-damp` | Default `motion/react` spring; matches Shipyard handoff baseline. |
| `--motion-stiff-soft` / `--motion-damp-soft` | Inspector rail slide-in. |
| `--motion-stiff-snap` / `--motion-damp-snap` | Accept commit pulse. |
| `--stagger-panel` | Bento boot reveal. |
| `--stagger-tray` | SpliceTray entrance, also re-fires on tray filter changes. |
| `--stagger-caption` | InspectorRail caption letter trail (per word, not per char). |
| `--stagger-timeline` | Timeline node spawn on accept (single node, but stagger applies if multi-accept ever lands). |
| `--probe-glow-*` | Three state-derived glow targets, all consumed by `ProbeField` post-process pipe. |
| `--probe-dampen-factor` | Multiplier applied to `--probe-drift-speed` while `pending` is non-null. |
| `--probe-flash-ms` | Accept choreography window inside the field. |
| `--probe-recover-ms` | Return-to-watching ramp after flash or rejection. |
| `--slide-*` | x/y offsets for entrance transitions. |

A small JS-side helper, `tokens.ts`, reads these at mount and exports typed numbers for use in motion springs and gsap durations. CSS remains the single source of truth; JS reads, never writes.

---

## 3. Field ↔ panels choreography

The probe field and the bento panels are stacked in the same canvas region. They are visually distinct layers but logically one scene. This section defines how events from one drive moves in the other.

### 3.1 Probe → panel

The probe field is the adversarial agent's working surface. When a probe reaches `detected`, three things happen in lock-step.

```
probe-detected event (origin: probes store)
  │
  ├─► field layer
  │     • that probe's pulse cycle starts (--probe-pulse-ms)
  │     • surrounding probes within radius 0.15 brighten 1.4x for --dur-quick
  │
  ├─► projection
  │     • map probe.x,y (NDC −1..1) to a bento grid cell via a lookup map
  │       built once in <BentoCanvas> from the rendered grid layout
  │
  └─► panel layer
        • target panel sets data-probe="active"
        • CSS rule: outline 1px var(--color-pending), fade in over --dur-quick
        • panel header pip dot animates from idle → pulsing for as long as
          probe stays detected
```

The projection map is a deterministic 2D-grid lookup. On `BentoCanvas` mount, after layout settles, walk panel `getBoundingClientRect()`s and store NDC ranges per panel ID. Re-run on resize. The probe field reads this map via a context (`ProbeRegionContext`).

Rule: a panel can be probe-active and pending-ghost simultaneously. They use different border treatments (outline for probe, inset shadow for pending) so they stack without conflict.

### 3.2 Panel → field

User-driven panel events propagate down into the field.

| Panel event | Field response | Tokens |
|---|---|---|
| Panel hover (any panel) | None. Hover is a panel-only state to keep idle calm. | n/a |
| Panel click (selection set) | Field-region tied to that panel brightens for `--dur-base`: probes whose NDC falls in the panel's region jump to 1.2x size. Decay back over `--probe-recover-ms`. | `--dur-base`, `--probe-recover-ms` |
| Panel pending → committed | Whole field flashes glow to `--probe-glow-flash`, holds `--probe-flash-ms`, decays to `--probe-glow-watching` over `--probe-recover-ms`. | `--probe-glow-flash`, `--probe-flash-ms`, `--probe-recover-ms` |
| Panel pending → rejected | No field flash. Field just lifts the dampening it took on at pending start. | `--ease-dampen`, `--dur-base` |

### 3.3 Splice gesture → field

The drag-rectangle gesture (`SpliceGesture.tsx`) is the most physical interaction in the app and the field needs to respond mechanically to make the demo land.

```
gesture: pointer-down inside canvas
  • field: drift-speed multiplier eases from 1.0 to --probe-dampen-factor
    over --dur-quick (--ease-dampen). Reads as "the field is paying
    attention".
  • panels: dim to opacity 0.85 over --dur-quick. Border-color shifts to
    var(--color-fg-subtle) so the panels visually recede.
  • cursor: --color-accent crosshair (already in CSS).

gesture: pointer-move (drag in progress)
  • drag rectangle renders on the gesture overlay.
  • probes inside the rectangle migrate color toward --probe-spliced over
    --dur-quick. Lerp factor is per-frame, not a one-shot tween, so it
    tracks live.
  • probes outside dim opacity 0.6 → 0.4.

gesture: pointer-up (commit)
  • dispatches stage(splice). Transitions to splice-pending.
  • probes inside region lock to --probe-spliced color.
  • drift-speed multiplier holds at --probe-dampen-factor; will release
    on accept/reject.
```

### 3.4 Choreography conflict resolution

Two events can collide. Cancel rules:

- New `pending` while old `pending` exists: kill the old ghost-out tween, fire ghost-swap (cross-fade old ghost to new ghost in `--dur-base`, no field re-dampen, field stays dampened).
- `accept` mid-probe-pulse: cancel pulse on the source probe, run accept choreography. Probe returns to baseline color as part of recovery.
- `reject` mid-accept: not possible in the UI, but if it ever races (keyboard fires both): drop the second event, keep accept.

All cancellable tweens carry an ID (`field.dampen`, `field.flash`, `panel.<id>.probe`, `inspector.slide`). One ID per concurrent tween. Kill by ID, no global kill-all.

---

## 4. Transition catalog

Each state edge specified concretely: what fades, slides, scales, with easing and duration. Easing names are GSAP-style; CSS equivalents already declared as tokens.

### 4.1 boot → watching

| Element | Property | From → To | Duration | Ease | Stagger |
|---|---|---|---|---|---|
| Body | opacity | 0 → 1 | `--dur-quick` | `--ease-out` | — |
| BentoCanvas grid container | opacity | 0 → 1 | `--dur-base` | `--ease-out` | — |
| Each Panel | y, opacity | `--slide-panel`, 0 → 0, 1 | `--dur-base` | `--ease-out` | `--stagger-panel` per panel, in grid-area order |
| ProbeField | density (0 → 220), glow (0 → `--probe-glow-watching`) | — | `--dur-boot` | `--ease-dampen` | — |
| Timeline | y, opacity | `--slide-tline`, 0 → 0, 1 | `--dur-base` | `--ease-out` | After last panel +120ms |
| CommandBar | opacity | 0 → 1 | `--dur-quick` | `--ease-out` | After last panel |

Implementation: one GSAP timeline owned by `<SceneRoot>`, mounted once at the top of `App.tsx`. Sets all elements to their `from` values pre-paint, then plays. Timeline is killed in `useEffect` cleanup; never replays.

### 4.2 watching → probing

| Element | Property | From → To | Duration | Ease |
|---|---|---|---|---|
| Probe (single) | scale | 1 → 1.4 → 1 | `--probe-pulse-ms` | sine.inOut, looped |
| Probe (single) | color | baseline → detected | `--dur-quick` | `--ease-out` |
| ProbeField glow | intensity | watching → probing | `--dur-base` | `--ease-dampen` |
| Target panel | outline-color | transparent → `--color-pending` | `--dur-quick` | `--ease-out` |
| Target panel header pip | opacity | static → pulsing 0.6↔1.0 | `--probe-pulse-ms` | sine.inOut, looped |

Reverse on exit (probe leaves detected): same durations, opposite direction, no overshoot.

### 4.3 watching/probing → splice-pending

| Element | Property | From → To | Duration | Ease |
|---|---|---|---|---|
| Probe field | drift-speed multiplier | 1.0 → `--probe-dampen-factor` | `--dur-base` | `--ease-dampen` |
| Probe field | glow | current → `--probe-glow-pending` | `--dur-base` | `--ease-dampen` |
| All panels | opacity | 1 → 0.92 | `--dur-quick` | `--ease-out` |
| Each panel | data-state attr | "idle" → "pending" | atomic | — |
| Each Wave (ghost path) | pathLength | 0 → 1 | `--dur-event` | `--ease-out` |
| InspectorRail | x | `--slide-inspector` → 0 | `--dur-base` | `motion/react` spring (`--motion-stiff-soft`, `--motion-damp-soft`) |
| InspectorRail | opacity | 0 → 1 | `--dur-quick` | `--ease-out` |
| InspectorRail caption words | opacity, y | 0, 4px → 1, 0 | `--dur-quick` | `--ease-out`, stagger `--stagger-caption` |
| Timeline pending dot | scale, opacity | 0, 0 → 1, 1 | `--dur-quick` | `--ease-settle` |

The two big moves (ghost draw and inspector slide) start on the same frame so the user reads them as one event.

### 4.4 splice-pending → splice-applied (accept)

| Element | Property | From → To | Duration | Ease |
|---|---|---|---|---|
| Wave ghost path | strokeWidth | 1.4 → 4 → 1.4 | `--dur-event` | `--ease-settle` |
| Wave baseline path | opacity | 1 → 0 | half of `--dur-event` | `--ease-in` |
| Wave ghost path | color | `--color-ghost` → `--color-baseline` | `--dur-event` | `--ease-out` |
| Each panel | gb-pulse keyframe | (existing) | `--dur-event` (extended from current 320ms) | `--ease-out` |
| Probe field glow | intensity | current → `--probe-glow-flash` → `--probe-glow-watching` | `--probe-flash-ms` then `--probe-recover-ms` | `--ease-out` then `--ease-dampen` |
| Probe field drift mult | `--probe-dampen-factor` → 1.0 | — | `--probe-recover-ms` | `--ease-dampen` |
| Spliced probes | color | `--probe-spliced` → `--probe-baseline` | `--probe-recover-ms` | `--ease-out` |
| Timeline pending dot | shape morph (◐ → ●), scale 1 → 1.15 → 1 | — | `--dur-base` | `--ease-settle` |
| InspectorRail caption | text swap (future tense → past tense) | crossfade | `--dur-quick` | `--ease-out` |

Continuity rule: the ghost overlay path data does not animate during accept. Only its width and color change. This sells the illusion that the ghost is "becoming" the new baseline rather than being replaced. After the accept finishes, the reducer swaps timeline head; on the next frame the panel renders the new head and there is no visible jump because the ghost already painted the same shape.

### 4.5 splice-pending → splice-rejected

| Element | Property | From → To | Duration | Ease |
|---|---|---|---|---|
| Wave ghost path | pathLength | 1 → 0 | `--dur-base` | `--ease-in` |
| InspectorRail | x, opacity | 0, 1 → `--slide-inspector`, 0 | `--dur-base` | `--ease-in` |
| InspectorRail caption words | y, opacity | 0, 1 → 6px, 0 | `--dur-quick` | `--ease-in` |
| Timeline pending dot | scale, opacity | 1 → 0 | `--dur-quick` | `--ease-in` |
| All panels | opacity | 0.92 → 1 | `--dur-quick` | `--ease-out` |
| Probe field drift mult | `--probe-dampen-factor` → 1.0 | — | `--dur-base` | `--ease-dampen` |
| Probe field glow | current → `--probe-glow-watching` | `--dur-base` | `--ease-dampen` |
| Spliced probes | color | `--probe-spliced` → `--probe-baseline` | `--dur-base` | `--ease-out` |

Reject is faster than accept (`--dur-base` vs `--dur-event`). It should feel like the field is shedding the proposal, not celebrating it.

### 4.6 timeline scrub (any-to-any)

User clicks a non-head node in the timeline. The whole canvas walks back through history.

| Element | Property | Duration | Ease |
|---|---|---|---|
| Each Wave | d (path interpolates intermediate states) | `--dur-scrub` per hop | `--ease-in-out` |
| Timeline cursor | x position | sum of hops × `--dur-scrub` | `--ease-in-out` |
| Probe field | no choreography; field stays watching | — | — |

Scrub is the only place where multiple state edges chain in a single user action. Use a GSAP timeline; not motion/react springs. Springs cannot enforce a deterministic total duration, and the demo needs to land at exactly the intended length.

### 4.7 selection edge (panel click)

Selection is the lightest edge in the system. It does not transition app state, only Inspector content.

| Element | Property | Duration | Ease |
|---|---|---|---|
| InspectorRail content (if previously selected) | opacity, y | `--dur-quick` | `--ease-in` |
| InspectorRail content (newly selected) | opacity, y | `--dur-quick` | `--ease-out` |
| Selected panel | data-state="selected" border-color | `--dur-quick` | `--ease-out` |

If selection happens during pending, the inspector content swaps but the rail does not slide.

---

## 5. Reduced-motion fallback

Every transition above has a degraded form. The current `globals.css` already kills all CSS transitions/animations under `(prefers-reduced-motion: reduce)`. That blanket rule stays. JS-driven motion (gsap, motion/react, three.js) is not covered by CSS rules and needs explicit handling.

### 5.1 Detection

A single hook, `useReducedMotion`, wraps `window.matchMedia('(prefers-reduced-motion: reduce)')` and returns a live boolean. Already present implicitly via the existing `ProbeField` `reducedRef` check; promote to a shared hook in `lib/useReducedMotion.ts` so every layer uses the same source.

### 5.2 Per-edge degradation

| Edge | Full motion | Reduced motion |
|---|---|---|
| Boot reveal | Stagger + slide + density ramp | Single fade-in over `--dur-quick`. Density set to 220 instantly. Panels visible immediately. |
| Probing pulse | Sine pulse + color lerp | Static color swap. No size change. |
| Field dampening | Drift multiplier eases over `--dur-base` | Drift speed set to 0 (probes freeze) instantly when pending starts. |
| Ghost path enter | `pathLength` 0 → 1 over `--dur-event` | Opacity 0 → 1 over `--dur-quick`. Path drawn fully on first frame. |
| Ghost path exit | `pathLength` 1 → 0 | Opacity 1 → 0. |
| Inspector slide | x + opacity spring | Opacity only. No translation. |
| Caption letter trail | Per-word stagger | Whole caption fades in once. Stagger is 0. |
| Accept commit pulse | Width pulse + glow flash + color migration | Border-color swap, no animation. |
| Reject | `pathLength` reverse + slide-out | Opacity fade-out only. |
| Timeline scrub | Multi-hop morph chain at `--dur-scrub` per hop | Direct jump to target state. No intermediate frames. |

### 5.3 Implementation rule

Wrappers, not branches. Each animation primitive used in the codebase reads `useReducedMotion` once at the call site and chooses between two parameter sets, both expressed in tokens. Example shape (illustrative, not code in this spec):

```
const prefs = useReducedMotion()
const ghostEnter = prefs
  ? { opacity: [0, 1], duration: tokens.durQuick }
  : { pathLength: [0, 1], duration: tokens.durEvent, ease: tokens.easeOut }
```

The probe field already routes to a `ReducedMotionField` SVG dot renderer when reduced motion is active. That stays; it's the right pattern for that layer.

---

## 6. GSAP plugins to register globally

GSAP is in `package.json` but no `gsap` import exists in `frontend/src/`. Registration must happen exactly once, before any GSAP timeline runs.

### 6.1 Plugins required

| Plugin | Used by | Why |
|---|---|---|
| `Observer` | Timeline scrub (wheel/touch/keyboard navigation through history) | Unified input abstraction. Lets the timeline accept wheel-on-canvas, arrow keys, and touch swipes through one API. Pattern is identical to `pen/XWzRraJ`. |
| `MorphSVGPlugin` | Wave ghost-to-baseline interpolation when point counts differ across splices | Bullet for the wave morph case where two paths have different `d` lengths. If COMPONENTS lane keeps point counts identical across splices, this is unused. Register defensively. **License note**: MorphSVGPlugin is part of GSAP Club. Free GSAP 3.13+ licensing covers personal use; verify hackathon submission license terms. If license is a blocker, drop the plugin and require equal point counts in fixtures. |
| `CustomEase` | Defining `--ease-settle` and `--ease-dampen` as named GSAP eases so JS-driven tweens can use the same names as CSS | Free, no license issue. |

Not registered:

- `ScrollTrigger`: Glassbox does not scroll. The window is a fixed pywebview frame at 1280×820. Skipping.
- `SplitText`: Captions are word-trail only, and motion/react `staggerChildren` handles that without a plugin.
- `Draggable`: `SpliceGesture.tsx` already handles drag with native pointer events. Adding Draggable doubles a working primitive.

### 6.2 Where registration lives

New file: `frontend/src/lib/gsapInit.ts`.

Imported once from `frontend/src/main.tsx` before `<App />` renders. Module-level side effect — `gsap.registerPlugin(...)` runs at import time. Idempotent (GSAP dedups internally), but one entry point keeps blame clear.

`gsapInit.ts` also defines the named `CustomEase` instances:

```
CustomEase.create('settle',  '0.20, 0.80, 0.30, 1.05')
CustomEase.create('dampen',  '0.40, 0, 0.60, 1')
```

After registration, gsap timelines refer to them as strings: `ease: 'settle'`. CSS uses the cubic-bezier directly via `var(--ease-settle)`. Both routes resolve to the same curve.

### 6.3 Treeshaking / bundle size

GSAP core + Observer + MorphSVG + CustomEase is roughly 70 KB minified. On WKWebView locally there is no network; bundle size only affects vite build time and pywebview launch latency. Acceptable.

---

## 7. Open questions / risks

1. **MorphSVG license under hackathon submission.** Glassbox is open-source and pip-installable, which makes the MorphSVG license question non-trivial. Action: verify GSAP Club license terms vs. MIT-style hackathon submission, or commit to equal-point-count waves across fixtures and skip MorphSVG. Default if unanswered at T-3h: skip MorphSVG.

2. **`motion` v12 spring API parity with `framer-motion` 11.** The DESIGN.md doc specifies framer-motion semantics (280 stiffness / 22 damping). The installed package is `motion@12.38`. Need to confirm `transition: { type: 'spring', stiffness, damping }` still works as written. Likely yes (motion is the renamed package), but verify against the v12 changelog before T-2h.

3. **R3F + GSAP coexistence.** GSAP timelines that target r3f scene properties cannot use `gsap.to(mesh.position, ...)` cleanly without `useFrame` integration. Recommendation: GSAP owns DOM choreography (panels, inspector, timeline cursor); r3f owns field choreography via `useFrame`-driven interpolation tied to glassbox state. The two systems share tokens but never share tweens. Confirm this division in implementation.

4. **Probe-region projection accuracy.** Section 3.1's probe-to-panel projection map assumes the field renders at the same NDC range as the bento canvas. Verify on first integration run; if the ortho camera zooms differently the map needs an offset. Low risk; one-time calibration.

5. **State-edge atomicity.** Section 1's "one choreography per edge" rule needs a tween registry. Recommend a `lib/choreography.ts` module that owns named tween IDs and exposes `kill(id)` / `play(id, fn)`. If this is overspec for 36 hours, fallback is gsap's built-in `gsap.killTweensOf(target)` per-element. Less clean but ships.

6. **Demo readability of probe field.** The field is decoration plus signal, but a 220-probe particle cloud during a 90-second demo might be visually noisy enough that the bias panels lose focus. Consider lowering `--probe-density` to 120 for the demo build, or fading the field opacity during pending state more aggressively (0.85 → 0.55) so the panels dominate when the user is reading them. Recommend a final calibration pass at T-1h with the actual demo content rendered.

7. **Boot timeline race with font load.** Atkinson Hyperlegible loads from Google Fonts CDN. If the font request stalls, captions render in fallback `system-ui` for the first ~200ms of boot. The boot timeline does not currently wait on `document.fonts.ready`. Recommend gating the boot timeline on `await document.fonts.ready` with a 400ms hard timeout (proceed regardless after that). Prevents a visible reflow during the boot reveal.

8. **Timeline scrub UX.** Section 4.6 specifies `--dur-scrub` per hop, but a 5-hop scrub takes 2.5s, which is too long for a 90-second demo. Consider capping total scrub at `--dur-event` × 2 (1.24s) regardless of hop count, with intermediate states briefly visible. Needs a product call; flag for user input.

9. **WKWebView-specific motion gotchas.** WKWebView on macOS Sonoma+ generally honors `prefers-reduced-motion` and Web Animations API. No known r3f issues. Lower-confidence claim: GSAP's `force3D` defaults may interact oddly with pywebview's compositing layer. Recommend a smoke test of the boot timeline on the actual pywebview build before T-2h. If jank shows, force `gsap.config({ force3D: false })` in `gsapInit.ts`.

10. **Selection while pending.** Section 4.7 says selection during pending swaps inspector content but does not slide. Confirm with COMPONENTS lane: does the inspector show the selected panel's view of the pending splice, or its baseline view? Either is defensible. Default for this spec: pending view (Inspector is always synced to current pending if pending exists, regardless of selection).

