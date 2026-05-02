# Glassbox Interactive Lane Design Spec

Lane: cursor, gesture, hover. The particle field is the model under inspection. Every interaction has to read on the first viewing of a 90-second demo. Track fit is "Wild Experiment" — the wow has to be in how the system reacts to the judge's hand.

Status: spec only. No code changes in this pass.

---

## 0. North star

The cursor is the judge's flashlight. The particle field is the inside of the model. When the judge moves the cursor, the field has to respond like a living tissue being palpated, not like a chart being scrubbed. Three concrete implications:

1. The cursor has to do something at all times the pointer is over the canvas. No dead zones. Even baseline drift acknowledges proximity.
2. Detected probes (the bias clusters) have to want attention. The field's job during the demo is to walk the eye to the wound.
3. After a splice, the field has to dim its own alarm. A spliced region should feel like the model breathing out.

Everything below derives from those three contracts.

---

## 1. Cursor → field interaction model

### Decision: spotlight + soft attraction, no repulsion

The cursor functions as a **directional spotlight with mild gravitational pull** on baseline probes within a falloff radius. Detected probes do not move toward the cursor — they react in glow only. This split is intentional. Letting detected probes drift breaks the spatial logic of "this cluster is biased on the sex axis at world position (0.55, 0.40)." Letting baseline probes drift makes the field feel breathing and alive even when the user does nothing interesting.

### Two layered effects

| Layer | Affects | Magnitude | Why |
|---|---|---|---|
| Spotlight (radial brightness boost) | All probes within radius | opacity +0.25, color shift toward `--color-fg` 30% | The judge's gaze and the field's brightness are coupled. Looks like the cursor is illuminating, not commanding. |
| Soft attraction | Baseline probes only | position offset toward cursor, max 0.04 world units, falloff cubic | Baseline probes feel like dust drawn to a lens. Detected probes stay anchored to where bias actually lives. |

Detected probes additionally **emit a faint label tether** (1px line from probe to a screen-edge label) when the cursor enters their personal radius (see §4).

### Math contract

Cursor position arrives in NDC (-1..1 across canvas). Project to world via the ortho camera:

```
worldX = (cursorNDC.x * canvasWidth / 2) / cameraZoom
worldY = (cursorNDC.y * canvasHeight / 2) / cameraZoom
```

Where `cameraZoom = 280` (current setting). For a 1280×820 window this gives roughly `worldX ∈ [-2.28, 2.28]`, `worldY ∈ [-1.46, 1.46]`. The probe field uses `[-1, 1]` normalized space, so cursor-world-x is **larger than the probe space** by ~2.3x. That is fine — probes outside the spotlight just don't react. Do not clamp the cursor world position to probe space; let it overshoot so reactions fade naturally at edges.

### Falloff curve

Spotlight radius: `0.55` world units.
Attraction radius: `0.30` world units.
Falloff: `f(d) = max(0, 1 - (d / R))^2` (smoothstep-ish, cheap, no `Math.pow` cost beyond squaring).

At `d = 0`, full effect. At `d = R/2`, 25% effect. At `d = R`, zero. The cubic-ish curve gives the cursor a clear "core" without a hard ring at the edge.

### What the cursor does NOT do

- No repulsion. Probes don't flee.
- No click effects on the field itself. Click belongs to splicing (separate gesture).
- No drag-pan of the field. The ortho camera is fixed.
- No rotation of the field around the cursor (this is the **deliberate divergence from the BaarZmV pen** — its mouse drives `rotation.x/y`, but our field is 2.5D, not a sphere).
- No magnetism on detected probes. Their job is to stay put as evidence.

### Why not BaarZmV's exact pattern

The pen rotates a sphere of 1600 vertices toward the cursor with `gsap.to(particles.rotation)`. That works because the sphere is the entire scene and orientation is the only meaningful state. Glassbox's field is a 2D bias map laid behind a bento. Rotating it would dissolve the spatial mapping that makes "this is a sex-axis cluster" legible. Borrow the **technique** (cursor-driven GSAP tween targeting an Object3D property) but **redirect the target** from `particles.rotation` to a uniform or a per-probe attribute.

### Implementation seam

The cursor handler lives on the existing `.gb-probe-field-overlay` div (already declared in `globals.css` with `pointer-events: auto`). It writes the cursor's world-space position into a single source: a `useRef` exposed via React context or a tiny store, consumed inside `FieldScene` via `useFrame`. Do **not** put cursor state in `useState` — every mousemove would re-render the entire scene. The `useFrame` hook reads the ref each frame and computes per-probe falloff.

---

## 2. Probe lifecycle visuals

Each probe transitions through `baseline → evaluating → detected → spliced` (sometimes skipping intermediate states). Today the transitions are implicit: `targetColor.lerp` runs at `0.08` per frame. That lerp is fine for color but does not produce **legible state events**. The judge has to see a transition happen, not just notice colors changed.

### Transition spec table

| From | To | Duration | Easing | Position | Scale | Glow | Trail | Sound metaphor |
|---|---|---|---|---|---|---|---|---|
| spawn | baseline | 320ms | ease-out (`var(--ease-out)`) | drift in from random off-axis offset 0.08 | 0 → 1 | 0 → 0.42 | none | a fleck appearing |
| baseline | evaluating | 180ms | linear | hold | 1 → 1.15 | 0.42 → 0.7, color shift to `--probe-evaluating` (#6b7280) | 1px short tail behind motion vector | a finger touching the probe |
| evaluating | detected | 520ms | overshoot (`gsap.back.out(1.7)`) | hold | 1.15 → 1.4 → 1.2 (settle) | flash to 1.0, color hard-cut to `--probe-detected` (#ef4444), then settle at 0.85 | 4-frame ring expansion 0 → 0.08 world units, fade 0.6 → 0 | an alarm bell hit once |
| evaluating | baseline | 240ms | ease-in (`var(--ease-in)`) | hold | 1.15 → 1 | 0.7 → 0.42, color back to `--probe-baseline` | none | dismissal |
| detected | spliced | **800ms total**, three-phase (see below) | composite | hold | 1.2 → 1.5 → 0.7 | 0.85 → 1.0 → 0.0 → 0.55 | flare ring 0 → 0.18 world units, fade 1.0 → 0 | a candle being snuffed and re-lit cooler |
| spliced | spliced | 1200ms ambient | sine | drift 0.005 amp | 1 (steady) | 0.55 sine ±0.1 | none | settled, watching |

### Detected → spliced choreography (the headline transition)

This is the only transition the demo actually pivots on. It has to read as "this probe was neutralized" without a label.

```
t=0       t=200     t=480       t=800
detected  flare-up  cool-fade   settled spliced
1.2x      1.5x      0.7x        1.0x
red 0.85  red 1.0   transparent amber 0.55
                    (paint flip)
```

Three phases:

1. **Flare** (0–200ms). Scale 1.2 → 1.5, glow 0.85 → 1.0. Status color stays `--probe-detected`. The probe brightens like a held sparkler. GSAP timeline, `power2.out`. Concurrent: emit an expanding ring sprite at the probe's world position, scale 0 → 0.18, opacity 0.6 → 0, lifetime 320ms.
2. **Paint flip** (200–480ms). The probe's color crossfades through transparent (opacity 1.0 → 0.0 → 0.55) while shrinking 1.5 → 0.7. Color crossfades from red to amber (`--probe-spliced`, #ffb86b) on the inverse curve. Net effect: the red probe collapses into nothing, then re-blooms as a smaller amber probe. **Critical:** the position must hold dead still through this phase. Movement during paint flip reads as "still active." Stillness reads as "neutralized."
3. **Settle** (480–800ms). Scale 0.7 → 1.0 (overshoot 1.05 → 1.0). Glow 0.0 → 0.55. Now in the spliced ambient state.

The flare ring is the only moving element other than the probe itself. Do not add particles, sparks, or trails — those read as celebration. We want quiet competence, not victory.

### Easing tokens

Reuse what's already in `globals.css`:
- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for entrances.
- `--ease-in: cubic-bezier(0.7, 0, 0.84, 0)` for dismissals.
- For the overshoot on `evaluating → detected`, GSAP's `back.out(1.7)` (not in tokens). Add a CSS easing approximation if we want to mirror in declarative animations: `cubic-bezier(0.34, 1.56, 0.64, 1)`.

### Pulse (`detected` ambient)

The current useFrame implementation pulses opacity via `0.6 + sin(phase * 3) * 0.4`. That gives a 2π/3 ≈ ~333ms cycle at the current `phaseRef` math (drift speed 0.06, multiplied by 12 = 0.72 rad/sec, so * 3 = 2.16 rad/sec → period ≈ 2.9s, much slower than 333ms). The CSS token `--probe-pulse-ms: 1200` is **not currently honored**. Spec: rewire the pulse to `2π / (--probe-pulse-ms / 1000)` so the token controls the cadence as designed. Detection pulses should be slower than the baseline drift wobble, around 1.2s, to feel deliberate rather than nervous.

---

## 3. Cluster reveal choreography

A cluster is N detected probes within a small region. The current fixture replay drops probes around four hardcoded centers (`probe-clusters.json`). What's missing: a **field-level signal** that says "look here." Today the only cluster cue is "more red dots happen to be near each other," which the eye does not parse fast enough for a 90-second demo.

### Detection rule

```
A cluster fires when ≥ 4 probes with status='detected' lie within a 0.22 world-unit radius
of any single detected probe added in the last 1500ms.
```

Implementation lives in the probe store, not the renderer. When `ingest()` lands a `detected` probe, recompute the local count for that probe's neighborhood; if the threshold trips and that cluster center hasn't already fired in the last 4 seconds, emit a `cluster-formed` event with the centroid and severity.

### Visual signal: bloom halo + caption tether

When a cluster fires:

1. **Halo** appears at the cluster centroid. Soft circular gradient, radius animates `0 → 0.32` world units over 720ms with `--ease-settle` (cubic-bezier(0.20, 0.80, 0.30, 1.05)). Color: `--probe-detected` at 0.18 alpha center, 0 at edge. Persists at full radius for 2400ms after expansion completes, then fades over 1200ms unless the user acknowledges (see dampening).
2. **Pulse echo.** A 1px stroke ring at the same centroid, expanding `0 → 0.45` world units over 1100ms with full opacity → 0. Fires three times, each offset 380ms. This is the GSAP-staggered version of a sonar ping.
3. **Caption tether.** A line from the centroid out to the nearest screen edge, terminating in a small caption pill: "BIAS CLUSTER — sex axis (4 probes)". Pill renders in HTML overlay (not WebGL) so the typography stays crisp and respects the Atkinson Hyperlegible system. Tether line: SVG, `stroke-dasharray: 4 4`, animated `stroke-dashoffset` for a soft "scanning" feel. Caption and tether share lifetime with the halo.

Only one cluster halo is shown at a time. If two clusters fire within the cooldown, the second is queued; if a third arrives, drop the oldest queued. The judge cannot follow more than one alarm.

### Dampening

After the user "acknowledges" the cluster, the halo fades fast (240ms) and the field returns to ambient. Two acknowledgement signals:

| Signal | What counts as ack |
|---|---|
| Cursor enters cluster halo | Halo dampens to 0.06 alpha within 240ms; tether persists with reduced opacity 0.4. |
| User performs splice covering the cluster | Halo dissolves entirely over 600ms in lockstep with the `detected → spliced` transitions of probes inside it. |

If the cursor never enters the halo and no splice happens, the halo auto-fades after 4000ms total lifetime. **Do not let halos persist indefinitely** — the field should always settle if the user is idle.

### Cluster reveal in the demo arc

Demo math: prober ingest rate is 14/sec, ~32% are detected (`Math.random() < 0.32`), so detected probes arrive at ~4.5/sec. A cluster of 4 should form roughly every 1–2 seconds in the bias-rich zones. That's fine; the per-cluster cooldown (4s) prevents alarm fatigue. The first cluster typically fires 3–5 seconds into the demo, which is the moment the judge needs the field to "narrate" itself. Lock the fixture seed if we want this consistent.

---

## 4. Hover affordance on probes

Probes are sub-pixel-rare-pixels at this density (220 probes in a `[-1, 1]²` field projected through ortho zoom 280 ≈ 5–7px diameter on screen). The judge will not hover precisely. We use a **proximity-based hit test**, not raycasting.

### Hit test

For each frame, find the **nearest detected or spliced probe** to the cursor in screen space. If the nearest is within `28px` screen radius, treat it as hovered. Baseline and evaluating probes do not respond to hover — they are ambient.

Why screen-px and not world units: the user's hand precision is measured in pixels, not in world space. Using the camera zoom to convert: `worldRadius = 28 / 280 = 0.1` world units. Use that for the per-frame distance check (cheaper than projecting every probe to NDC).

Pseudocode:

```
const hoverRadiusWorld = 28 / cameraZoom  // 0.1
let nearest = null, nearestDist2 = hoverRadiusWorld * hoverRadiusWorld
for (const p of probes) {
  if (p.status !== 'detected' && p.status !== 'spliced') continue
  const dx = p.x - cursorWorldX
  const dy = p.y - cursorWorldY
  const d2 = dx*dx + dy*dy
  if (d2 < nearestDist2) { nearestDist2 = d2; nearest = p }
}
```

### What appears

A floating tooltip card anchored just outside the probe (offset 12px screen, biased toward whichever side has more room — pin to the side with greater distance to viewport edge). Card contents:

```
┌─────────────────────────────────────────┐
│  PROBE  · sex                           │
│  ──────────────────────────────────────  │
│  white male, 45, doctorate, 60h/week    │
│                                         │
│  87% confidence — prediction shifts     │
│  when sex alone changes.                │
└─────────────────────────────────────────┘
```

Three rows:
1. Header: "PROBE · {protectedAttribute}", with `gb-unit-label` styling (10px, 0.14em letter-spacing, uppercase, muted).
2. Body: the probe's `label` (synthetic counterfactual description) at 13px Atkinson Hyperlegible regular.
3. Confidence and consequence, monospace number on a single line, body weight prose for the tail.

For `spliced` probes, the body changes:
- Header: "SPLICED · sex"
- Body: the original counterfactual label (kept for evidence)
- Confidence row: "Splice covered this probe — outcome shifted to model parity."

### Anchoring math

Probe screen position: `(probe.x * cameraZoom + viewport.width/2, viewport.height/2 - probe.y * cameraZoom)`. Card anchored at that point + 12px offset toward the side with more space. If probe is in the right 40% of viewport, anchor on left of probe, etc. Card max-width 280px, no wrap on first line of body.

### Dismissal

Card fades out (80ms) when:
- Cursor moves beyond `36px` screen radius from the probe (8px hysteresis to prevent flicker).
- Probe transitions to `spliced` (rare while hovered, but possible if a splice fires during inspection).
- Pointer leaves the canvas overlay.

Card remains visible (stays anchored to its probe) when:
- Cursor moves but stays within hysteresis.
- Probe drifts (which it does — baseline ± 0.015 world units sine wobble, a fraction of a pixel on screen).
- A different cluster halo fires elsewhere.

### Pointer-events caveat

The current `.gb-probe-field` has `pointer-events: none` so the bento panels can be clicked. The hover overlay needs `pointer-events: auto` but **must not** block the bento. Solution: the existing `.gb-probe-field-overlay` sibling is the right surface, but the tooltip itself must `pointer-events: none` so it can never be clicked. The tooltip is read-only.

### Not selectable, not clickable

Probes are not interactive in the click sense. Click belongs to the splice gesture (drag a region). Hover is for inspection only. This is a deliberate constraint to keep the gesture vocabulary minimal: cursor moves = look, drag = splice. Nothing else.

---

## 5. GSAP integration plan

GSAP is in the spec but not yet in `package.json`. **Risk flag**: `ProbeField.tsx` does not currently import gsap, but the user's spec says deps already include it. Confirm install before implementing. Same flag applies to `three`, `@react-three/fiber`, `@react-three/drei`, all referenced in `ProbeField.tsx` and not in `package.json`. If those are missing, `npm install gsap three @react-three/fiber @react-three/drei` is a precondition for any of this lane.

### Decision matrix: GSAP vs useFrame vs Motion

| Use case | Owner | Why |
|---|---|---|
| Cursor-driven spotlight (reads cursor every frame, no end state) | `useFrame` | Per-frame uniform/attribute updates. GSAP would re-create tweens every mouse event. |
| Cursor-driven attraction offset on baseline probes | `useFrame` | Same — continuous, no fixed target. |
| Probe `evaluating → detected` overshoot pop | GSAP timeline | Discrete state event with non-linear easing (`back.out`). GSAP's overshoot is cleaner than hand-rolled in useFrame. |
| Probe `detected → spliced` three-phase choreography | GSAP timeline | Multi-stage with crossfades and timing offsets. The exact use case GSAP was built for. |
| Cluster halo expand / pulse echo / fade | GSAP timeline | Discrete event, multi-property, staggered echoes. |
| Caption tether dash animation | CSS keyframes | Pure visual loop, doesn't need a tween engine. |
| Tooltip enter/exit | Motion (framer) | Already in deps. Standard React mount/unmount with spring. Don't pull GSAP for HTML elements when Motion is sitting there. |
| Probe baseline drift (the existing per-probe sine wobble) | `useFrame` | Already implemented. Don't migrate. |
| Probe pulse on detected status | `useFrame` reading `--probe-pulse-ms` | Continuous oscillation. Not a tween. |
| Reduced-motion fallback rendering | None (static CSS only) | See §7. |

### Why this split

- **GSAP** owns discrete events with non-trivial easing or multi-property orchestration. It is the right tool for "this probe just got spliced" but the wrong tool for "the field always reacts to the cursor."
- **useFrame** owns continuous, per-frame WebGL updates. It is the right tool for "every probe within R of the cursor brightens." It is the wrong tool for "in 800ms, transition through three visual phases."
- **Motion** owns React-tree DOM animations (tooltip, caption pill). It is already imported. Don't add GSAP for those.

### GSAP target patterns inside R3F

The BaarZmV pen does `gsap.to(particles.rotation, {...})`. That targets a Three.js `Object3D` property. In R3F, the equivalent is grabbing the mesh ref and tweening properties directly:

```tsx
const meshRef = useRef<THREE.Mesh>(null)
useEffect(() => {
  if (!meshRef.current) return
  const tl = gsap.timeline()
  tl.to(meshRef.current.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.2, ease: 'power2.out' })
    .to(meshRef.current.material, { opacity: 0, duration: 0.28 }, 0.2)
    .to(meshRef.current.scale, { x: 0.7, y: 0.7, z: 0.7, duration: 0.28 }, 0.2)
    // etc.
  return () => { tl.kill() }
}, [probe.status])
```

**Caveat:** GSAP is not re-render-aware. If the component unmounts mid-tween, the timeline can write into a disposed THREE object. Always store the timeline in a ref and `tl.kill()` in the effect's cleanup.

**Second caveat:** `useFrame` and GSAP both write to the same THREE properties. The current ProbeField uses `useFrame` to write `mesh.position` and `material.opacity`. If GSAP also writes to `material.opacity`, the last writer per frame wins, and useFrame runs after GSAP's `requestAnimationFrame` tick in the React reconciler order. This means GSAP-set values get clobbered by useFrame on the same frame. **Resolution:** during state transitions, gate the useFrame writes behind a `if (transitionInProgress) return`. The transition flag lives in a ref on the mesh component.

### GSAP plugin scope

Don't pull MorphSVGPlugin, ScrollTrigger, Observer, or any plugin not in the free tier. Core GSAP only. The Observer pattern (XWzRraJ pen) is interesting for unifying wheel/touch/pointer if we add scrub-the-timeline behavior, but that's a phase-3 concern; out of scope here.

---

## 6. Performance budget

### Current shape

- 220 probes per `--probe-density`.
- Each probe = one `<mesh>` with `<sphereGeometry>` (8x8 segments) and `<meshBasicMaterial>` (transparent, additive blend).
- `useFrame` per probe writes position, opacity, color every frame. Drift is per-probe.
- Reduced-motion fallback: SVG circles, no animation.

### Cost estimate at 220 probes

Each sphere @ 8x8 segments ≈ 112 triangles. Total ≈ 24,640 triangles. Negligible for WebGL2 on modern Mac WKWebView. The cost is **not in the geometry**; it's in **220 React mesh components each running its own useFrame and material/uniform updates**. Every frame, that is 220 closures executing, 220 material property writes, and 220 React reconciler entries (because `useFrame` doesn't re-render but the component is mounted).

### Crossover thresholds

| Probe count | Recommendation |
|---|---|
| ≤ 220 (current spec) | Per-probe mesh acceptable. `useFrame` aggregation across 220 closures is fine on modern hardware. |
| 220 – 500 | Consolidate `useFrame` into one parent `FieldScene`-level loop that iterates all probes. Per-probe components stay but lose their useFrame. |
| > 500 | Switch to `InstancedMesh`. The existing comment in `ProbeField.tsx` already flags this at "~500." |
| > 2000 | Switch to a single `Points` system with a custom shader. The BaarZmV pen does this with 1600 vertices in one geometry. |

### Where instancing helps and doesn't

`InstancedMesh` shares geometry across instances and writes per-instance transforms via a single attribute matrix array. Big win for position and scale. Color and opacity per-instance need either per-instance attribute streams (`InstancedBufferAttribute`) or a custom shader. The current per-probe-color story (lerping toward a target) becomes a per-instance color attribute the parent updates each frame. That's one `Float32Array.set()` call per frame instead of 220 React component updates. Net: large win, moderate refactor.

**Spec recommendation:** stay per-probe-mesh for the demo. The current density (220) is comfortably below the threshold, and instancing introduces cognitive overhead for transitions (you can't `gsap.to(mesh.scale)` on instance #47; you have to write a per-instance scale attribute manually). Lock the path: **per-probe mesh through phase 1, instancing only if phase-3 brings real BB sessions with > 500 simultaneous probes**.

### useFrame consolidation (phase-1 quick win)

Even at 220 probes, replacing 220 separate `useFrame` closures with one parent `useFrame` that iterates all probes is a 40-50% CPU reduction. Estimated cost to implement: 30 minutes. Recommended unless we're tight on time. Pseudocode:

```tsx
function FieldScene() {
  const probes = useProbes()
  const meshes = useRef<Map<string, THREE.Mesh>>(new Map())

  useFrame((_, delta) => {
    for (const probe of probes) {
      const mesh = meshes.current.get(probe.id)
      if (!mesh) continue
      // per-probe drift, glow, color logic here
    }
  })

  return probes.map(p => <ProbeMesh key={p.id} ref={...} />)
}
```

### Spotlight / attraction cost

Per frame: read cursor world position, iterate probes, compute distance, apply falloff. That's 220 distance checks + 220 attribute writes. Cheap. The cursor read is one ref deref per frame, not a re-render.

### Halo + tether overlay cost

Halos are SVG/HTML, not WebGL. Maximum 1 visible at a time (queued, not simultaneous). Cost is one Motion-driven HTML element. Negligible.

### Frame budget targets

- Idle (no events): 60fps locked. Drift + spotlight only.
- Active (probe events flying in at 14/sec, occasional GSAP transitions running): 60fps target, 50fps acceptable floor.
- Cluster halo + 4 simultaneous splice transitions: 60fps target. If frame time spikes during the splice phase, drop the ring expansion (the halo + caption are the load-bearing signals; the rings are decoration).

### What to measure

- Per-frame CPU in Chrome DevTools (WKWebView debug tools mirror this).
- Time spent in `useFrame` closures vs. actual render.
- React commit count during a 5-second window of probe events.

If `useFrame` time exceeds 4ms/frame at 220 probes, ship the consolidation. If render commits exceed 30/sec while probes stream in, throttle the `useProbes()` hook to coalesce updates (currently every `ingest()` triggers `setTick`, which is one re-render per event ≈ 14/sec; that may already be too high once interactions land).

---

## 7. Reduced-motion fallback

The existing `ReducedMotionField` renders a static SVG of all current probes. Spec extensions for the interactive lane:

### What stays

- Probe positions and colors (already correct).
- Status-based fill (baseline / evaluating / detected / spliced).
- Hover tooltip (it's HTML, not motion). Show on cursor proximity exactly as in §4.
- Cluster caption tether and pill (also HTML/SVG static — no halo expansion, no pulse echoes).

### What becomes static

| Effect | Reduced-motion replacement |
|---|---|
| Cursor spotlight | None. The field is fully visible at uniform opacity. |
| Cursor attraction | None. Probes don't move. |
| Baseline drift wobble | None. Probes are pinned. |
| Detected probe pulse | None. Detected probes render at static `--probe-detected` color, full opacity. |
| Halo expansion | Static circle outline at full radius, no expansion. Caption pill still appears. |
| Pulse echoes | Removed. |
| `evaluating → detected` overshoot | Instant color swap. |
| `detected → spliced` three-phase | Instant color swap to `--probe-spliced`. No flare ring. |

### What's already correct

`globals.css` already has the `prefers-reduced-motion: reduce` rule that flattens all transitions and animation-durations to 0.01ms. The `ProbeField` component checks the media query at mount and routes to `ReducedMotionField`. Good. The only addition for this lane: **the cluster caption tether and the hover tooltip must work in the SVG path too**. Today they don't — they only render in the WebGL Canvas world. Spec: lift the tooltip and caption pill out of the WebGL scene into a sibling `<div>` overlay so they render in both paths.

### A note on accessibility-of-color

The `--probe-detected` red (#ef4444) and the `--probe-spliced` amber (#ffb86b) are the only differential colors a colorblind user sees. The shape is identical. Spec recommendation: in reduced-motion mode (which often correlates with users who have other motor or visual considerations), add a small status glyph next to spliced probes — a 6px diagonal slash, matching the "neutralized" semantic. Implementation: SVG `<line>` overlaid on the circle. Out of scope to mandate but flag as a follow-up.

---

## 8. Open questions and risks

### Open questions

1. **Demo replay determinism.** The current `proberAgent.ts` uses `Math.random()` everywhere. For a 90-second demo, do we want deterministic playback (seedable RNG, replayable on demand) or believable randomness (fresh each load)? The Backboard handoff comment says "deterministic fixture file once we have a real BB session capture to anchor the demo" — that exists in a vacuum until the BB capture lands. Recommendation: **seed the RNG before T-2h** so we can rehearse with a fixed cluster timing. Math.random() is unseedable in stock JS; use `mulberry32` or similar (~10 lines).
2. **Cursor leave behavior.** When the cursor leaves the canvas, do baseline probes snap back to anchor or continue from offset and slowly relax? Spec leans toward **slow relax** (250ms ease-out). Snap looks robotic. Confirm.
3. **Splice gesture overlap.** This lane defines hover tooltips on detected/spliced probes. The gesture lane (`SpliceGesture.tsx`, separate spec) defines drag-to-splice. Both consume the same `.gb-probe-field-overlay` div. Order of dispatch: drag start cancels hover tooltip and any pending hover. Need to confirm with the gesture lane spec; flagging as boundary issue.
4. **Cluster halo and bento overlap.** When a cluster fires near the edge of the field, the halo can render under a bento panel (z-index: 0 on `.gb-probe-field`, z-index: 2 on `.gb-bento-canvas`). Today the halo would be partially occluded. Three options: (a) accept occlusion; (b) raise halos to z-index: 3 with `pointer-events: none`; (c) clip halos to "field-not-covered-by-bento" region. **Recommendation: (b)**. The halo is the alarm; it should always be visible. Caption tether terminates at the screen edge, so its endpoint is in the gutter, fine.

### Risks

1. **GSAP / R3F deps may not be installed.** `package.json` shows only `react`, `react-dom`, `motion`, `clsx`, `tailwind-merge`, `tailwindcss`. The ProbeField file imports from `@react-three/fiber` and `three`. Either the install lives in a parent or this is broken. Verify before any of this lane lands. If GSAP isn't in: add it (`npm install gsap`). Bundle cost: ~30KB gzipped for the core. Acceptable.
2. **WKWebView WebGL2 quirks.** Pywebview embeds the system WebKit. macOS Sequoia (current) ships with a WebKit that has full WebGL2, but `additive blending` + `transparent: true` + `depthWrite: false` (the current ProbeField material setup) can produce z-fighting on Intel iGPUs at z values near zero. The current probe z is `cluster.severity * 0.5`, which puts most probes in `0.0 – 0.5` world space. Should be fine. **Mitigation:** if z-fighting appears in testing, push the camera further (z: 5 → 10) and bump zoom proportionally.
3. **Tooltip flicker at cluster edges.** Multiple detected probes within 28px screen radius creates oscillating "nearest probe" picks as the cursor moves. Spec says "nearest" wins, but the tie-breaker is undefined. Risk: flicker. **Mitigation:** when a tooltip is active, give the active probe a hysteresis bonus (multiply its effective distance by 0.85) so it stays sticky until clearly displaced.
4. **Halo occlusion vs. bento layout.** See open question 4. If we go with z-index: 3, the halo can cover bento panel content. The visual story works (the alarm interrupts), but if any panel has a critical caption visible during a halo, it'll be obscured. Spec compromise: halo at z-index: 3, caption pill at z-index: 4, but **halo opacity caps at 0.18** so panel text is still readable through it.
5. **GSAP timeline lifecycle vs. probe unmount.** Probes can be removed from the store when the prober gets reset or the demo loops. If a GSAP timeline is mid-tween on a probe that just unmounted, you get a warning at best and a write-after-dispose at worst. Spec: every probe component owns its tween, stores it in a ref, kills on cleanup. Verify in implementation review.
6. **220 hover hit-tests per frame.** §4 specifies a per-frame loop over all probes filtered to detected+spliced. Detected counts grow over the demo (up to ~50 by the 90s mark). 50 distance checks per frame is trivial. But if the count grows unbounded (no eviction), it could matter. Spec: probes never expire; the demo is 90s; growth bounded. Don't optimize prematurely.
7. **Canvas sizing.** `Canvas` from R3F sizes to its parent. The `.gb-probe-field` is `position: absolute; inset: 0`, so it fills the dashboard region. On window resize, R3F auto-resizes. Cursor world projection in §1 depends on canvas dimensions, not window dimensions. Read from the canvas element, not `window.innerWidth`. Easy mistake; flag for implementation.

### Out of scope for this lane

- The drag-to-splice gesture itself (separate lane).
- Bento panel hover/click behavior (separate lane).
- The CommandBar and timeline scrubbing (separate lane).
- Real Backboard wire-up (phase 3).
- WebGPU migration (deliberately not chosen).

---

## 9. Summary table — what this lane ships

| # | Behavior | Surface | Driver | Reduced-motion |
|---|---|---|---|---|
| 1 | Cursor spotlight (radius 0.55 world) | All probes | `useFrame` reading cursor ref | Removed |
| 2 | Cursor attraction (radius 0.30 world, baseline only) | Baseline probes | `useFrame` | Removed |
| 3 | Probe spawn-in | New probes | GSAP one-shot | Instant |
| 4 | `evaluating → detected` overshoot pop | Probe mesh | GSAP timeline | Instant color swap |
| 5 | `detected → spliced` three-phase choreography | Probe mesh | GSAP timeline | Instant color swap |
| 6 | Detected ambient pulse | Probe material opacity | `useFrame`, period from `--probe-pulse-ms` | None |
| 7 | Cluster halo + pulse echoes | HTML/SVG overlay | GSAP timeline | Static circle |
| 8 | Cluster caption pill + tether | HTML/SVG overlay | Motion enter/exit | Static |
| 9 | Hover tooltip on detected/spliced | HTML overlay | Motion enter/exit | Same |
| 10 | Cluster dampening on cursor enter / splice | Halo opacity | GSAP timeline | Instant |

Everything above is spec only. No code in this pass.
