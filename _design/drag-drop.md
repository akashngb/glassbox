# Glassbox Drag-Drop Spec — splice gesture, drop targets, pickup affordance

Lane: DRAG-DROP. Owns the central physical interaction the demo hinges on: grabbing a region of the probe particle field and dropping it onto a splice primitive in the SpliceTray. Also owns timeline scrub drag, splice-tile reordering inside the tray, and any future panel rearrange.

This spec defers to `/Users/kelly/glassbox/_design/system.md` for choreography rules: state machine, named-tween registry, atomicity. Tokens introduced here extend the `@theme` block already declared in `globals.css` and the additions specified in system.md §2. No magic numbers.

Stack inheritance (verified 2026-05-02 against `package.json`): React 19, `motion` 12, `gsap` 3.15 (Observer plugin to be registered globally per system.md §6), `three` 0.184, `@react-three/fiber` 9. Pointer Events API native. **`dnd-kit` is not installed**. HTML5 native drag-and-drop is not used (covered in §1.6 with rationale). WKWebView on macOS Sonoma is the runtime; cursor is constrained to standard CSS cursors.

Out of scope here: panel-internal interactions (covered by COMPONENTS), system-level transitions (covered by SYSTEM), individual splice algorithm semantics (covered by Python lane).

---

## 1. Splice gesture spec — the central flow

The splice gesture is a five-phase finite state machine driven entirely by Pointer Events on a single overlay (`SpliceGesture.tsx`). Each phase has an entry condition, an exit condition, a visual signature, and a graceful-failure path.

```
idle → arming → selecting → carrying → committing → idle
                  │            │           │
                  └─cancel─────┴───────────┘
```

Vocabulary:
- **Region**: the rectangle the user draws over the probe field. Stored in normalized world coords ([-1, 1] on x and y), matching the existing `clientToWorld` helper.
- **Carrying**: pointer is still down, region is locked, cursor is now leaving the field heading for a tray tile. Region travels visually with the cursor as a "lifted slice".
- **Drop target**: a single splice tile in the tray. Tray acts as 5 distinct hit-test rectangles, not one container.

### 1.1 Phase: idle

Pre-state. No drag in flight. Field renders at watching glow. Cursor is `crosshair` over the field (already declared in `globals.css` for `.gb-probe-field-overlay`).

Entry: app boot, or any phase exit.
Exit: `pointerdown` on the field overlay.

### 1.2 Phase: arming (0–threshold ms / px)

The user pressed down but hasn't moved yet. The system waits to disambiguate "intent to drag" from "stray click". This is the lane the existing `SpliceGesture.tsx` skips over — it commits to a drag immediately, which means a click on the field accidentally creates a zero-area region.

Entry: `pointerdown` inside `.gb-probe-field-overlay`.
Exit conditions:
- `pointermove` exceeds **`--drag-arm-distance` = 6px** in screen space → enter `selecting`.
- `pointerup` before threshold → return to `idle` (silent cancel; no rectangle ever rendered).
- 300ms elapsed without movement → enter `selecting` anyway (pressure-and-hold path).

Visual: cursor stays `crosshair`. No rectangle yet. Closest probe-cluster halo (see §4.2) brightens 1.1× to confirm the field heard the press.

Why this phase: the demo runs in pywebview where a stray click on the field is more common than not (judges click around). Arming kills the bug where every click leaves a flash-of-rectangle.

### 1.3 Phase: selecting (region growing)

The user is sweeping the rectangle. This is the only phase where the region's geometry mutates.

Entry: armed and pointer crossed `--drag-arm-distance`.
Exit conditions:
- `pointerup` outside any tray tile, region area >= `--drag-min-area`: enter `carrying` if the user crosses out of the field bounds without releasing; otherwise enter `committing` directly with whatever tile is under the cursor (rare path, mostly happens with keyboard simulation).
- Standard demo path: `pointerup` happens in `carrying` or `committing`, not here.
- `Escape` keydown → cancel to `idle` (region dissolves, see §1.6).

Visual signature:
- **Rectangle**: 1px dashed `--color-pending` border, fill `color-mix(in srgb, var(--color-accent) 8%, transparent)`. Already implemented; keep.
- **Probes inside region**: migrate color toward `--probe-spliced` per the lerp loop in system.md §3.3. Per-frame lerp factor 0.08 already used elsewhere in the field.
- **Probes outside region**: opacity ramp from 0.85 → 0.55 over `--dur-quick`. They visually recede; the user reads the inside-of-region as "lifted".
- **Panels**: dim to 0.92 opacity per system.md §3.3 panel→field rule. Also receding so the field reads as the active surface.
- **Field drift**: drift-speed multiplier already eased to `--probe-dampen-factor` on `pointerdown`. Stays dampened through this phase.
- **Region label**: small monospace count-up tag pinned to the rectangle's top-right corner, e.g. `34 PROBES`, font `--font-mono`, size `--text-meta`. Tabular numerics. Updates on every pointermove. Reads "you have 34 specimens grabbed".

The label is a recommendation, not load-bearing. Skip if implementation cost runs high; the rectangle alone communicates the gesture. **Lower-confidence: I have not validated the count-up tag against demo readability at 1280×820. Calibrate at T-1h.**

### 1.4 Phase: carrying (region locked, cursor en route to tray)

The user has lifted the rectangle's geometry as a unit. The rectangle stops growing. The cursor's job is now to choose a drop target.

Entry: pointer crosses out of the field overlay's bounding rect with the button still down. Detect via `pointerout` on the overlay element (use `pointermove` outside the host rect rather than `pointerleave` because pointerleave is fired even on partial-cell exits in WKWebView).

Exit conditions:
- Pointer enters a tile's hit-test radius → tile flips to receptive, see §3.
- `pointerup` over a tile → enter `committing`.
- `pointerup` not over a tile → graceful drop-back, see §1.6.
- Pointer re-enters the field bounds → return to `selecting` (region resumes growing from its new corner). This lets the user "correct" mid-flight.

Visual signature:
- The rectangle "lifts": detaches from the field plane via a short `transform: translateY(-2px)` and a `box-shadow: 0 4px 16px rgba(0,0,0,0.4)` over `--dur-quick`. Reads as "this slice is now in your hand".
- A faint trailing line connects the rectangle's center to the cursor position, 1px solid `--color-pending` with 35% opacity. The line tells the user "this region is still tied to your hand". Decays over the first 12px of cursor travel; full opacity at field edge, 0% by 200px out.
- The rectangle stays in place spatially; only the lift shadow changes. Resist the temptation to make the rectangle follow the cursor — that breaks the "this region of the model" reading and makes it look like a draggable card.
- Tray tiles enter their drop-active state, see §3.

Why no card-follows-cursor: the Stitch reference behavior is "ghost-stays-put, semantics-attach-to-cursor". The user is not moving a card; they are pointing at a remedy for a specific region. The line preserves that read.

### 1.5 Phase: committing (over a tile, releasing)

The user is releasing over a valid tile.

Entry: `pointerup` while the cursor is inside a tile's hit-test region and the tile is in `accept` state (see §3).
Exit: dispatches `stage(splice)` and resets to `idle` after the system.md `splice-pending` choreography fires.

Visual signature:
- Tile fires its accept choreography (§3.4).
- Rectangle "drops into" the tile: center of rectangle tweens toward tile center over `--dur-quick`, scale 1 → 0 with `--ease-in`. Reads as the slice being absorbed.
- Probes inside the original region lock to `--probe-spliced` color (no further migration tween).
- Backboard splice fires immediately; `stage(splice)` is dispatched in parallel so the dashboard ghost overlay starts drawing the same frame the rectangle disappears.

The user has now triggered the system.md `splice-pending` state. From here all choreography is owned by SYSTEM. DRAG-DROP returns to `idle`.

### 1.6 Graceful failure paths

Every off-happy-path should resolve without the user feeling like they broke the app.

| Failure | Detection | Visual response |
|---|---|---|
| Click without drag | `pointerup` in `arming`, never reached `selecting` | No rectangle ever appeared. Silent. Idle stays idle. |
| Region too small | `pointerup` in `selecting` with `area < --drag-min-area` | Rectangle pulses red border for `--dur-quick` (`--color-bad`), fades out over `--dur-base`. No splice fires. **Caption** appears at field bottom-center: "Region too small. Drag larger to splice." Caption auto-dismisses after `--dur-event`. |
| Drop outside any tile | `pointerup` in `carrying`, no tile hit | Rectangle plays "fall back" animation: scales 1 → 0.95, opacity 1 → 0 over `--dur-base` with `--ease-in`. Slot returns to idle. No caption (the user read the situation themselves). |
| Drop on a tile that rejects this region | `pointerup` over tile in `reject` state | Tile fires reject choreography (§3.4). Rectangle plays the same "fall back" as above. Caption near tile: "Threshold splices need a continuous attribute. This region spans race." Caption fades over `--dur-event`. |
| Region empty (no probes inside) | At `pointerup`, count of probes inside region is 0 | Same as "region too small" but with caption "No probes in this region. Try a denser area." |
| Pointer cancel (system steals input) | `pointercancel` event fires | Same as `Escape`. Rectangle dissolves over `--dur-quick`. No splice. |
| Escape pressed during any phase | `keydown` Escape | Region dissolves, field recovers from dampening per system.md `splice-rejected` field rules. |

The "caption near tile" affordance is a single transient toast. One caption channel, one at a time. If a new caption fires while the previous is on screen, the previous is killed instantly and the new one fades in.

### 1.7 Why not HTML5 drag-and-drop

HTML5 `dragstart`/`dragover`/`drop` is the obvious tool for "drag from one place to another". Three reasons it's wrong here:

1. **The drag source is a WebGL canvas behind a transparent overlay.** Native dnd needs a `draggable` element with content. Faking it with a 1×1 transparent div is an active hostility against ourselves later.
2. **The default drag image is the dragged element.** We want a custom rectangle that lives on the field, not a ghost image of an invisible div.
3. **WKWebView platform-drag interactions can leak to the host OS.** macOS will treat a dragged element as a system-level drag with potential cross-app side effects (cursor changes, escape-key behavior). We control none of that.

Pointer Events API does what we need: capture at the overlay, no implicit ghost, no system-level leakage. Use it.

---

## 2. Region selection mechanic

**Choice: rectangle.** Justification, then spec.

### 2.1 Why rectangle over lasso or radial

| Mechanic | Demo readability | Dev cost | Verdict |
|---|---|---|---|
| **Rectangle (drag-corner-to-corner)** | Reads instantly as "select a slice". Familiar from desktop file selection, Figma marquee, every chart-zoom UI. | Already half-built in `SpliceGesture.tsx`. ~20 lines to reach the spec below. | **Pick.** |
| Lasso (freehand path) | Visually beautiful but reads as drawing/painting. Judges may interpret "I'm drawing on the model" rather than "I'm grabbing a slice". | Path simplification, point-in-polygon hit test on every probe, harder to communicate via screen recording. | Drop. |
| Radial (drag from center, distance = radius) | Reads as a spotlight/scope. Could work but encodes one-shape-per-gesture. Doesn't allow asymmetric selections. | Easy. | Drop on the basis that asymmetric bias clusters (e.g. one quadrant of the field) need rectangles, not circles. |

Rectangle is also the only mechanic that survives the demo-recording test: a screenshot of mid-gesture is legible without context.

### 2.2 Rectangle spec

| Param | Token | Value | Why |
|---|---|---|---|
| Min drag distance to start (arm threshold) | `--drag-arm-distance` | `6px` | Below click-jitter on a trackpad (~3-4px) but above mouse-click jitter (~1px). 6 is the conservative pick. |
| Min region area to commit | `--drag-min-area` | `0.0036` (world-space, ≈ 6%×6% of field) | Below this, the user almost certainly didn't grab anything; the field is a 2×2 square in world coords. 6% × 6% = 36 thousandths of total area. |
| Max region area | `--drag-max-area` | `2.56` (world-space, ≈ 80%×80%) | Above this, the user grabbed everything and the splice is meaningless. Cap by clamping rectangle corners during `selecting`. |
| Min probes inside region | `--drag-min-probes` | `3` | Below 3 probes there's no statistical region, just a few accidents. |
| Probes inside: color migration | (driven by per-frame lerp) | factor `0.08` per frame | Already in use in `ProbeMesh`. Reads as "the field is paying attention to these probes". |
| Probes inside: scale | none | (no change) | Resist scale changes. The rectangle is the marker, not probe size. Scaling probes inside breaks the visual that the user is grabbing the field as-is. |
| Probes outside: opacity | `--probe-outside-opacity` | `0.55` (from default `0.85`) | Backgrounds the rest of the field without erasing it. The user still wants to see the global context. |
| Probes outside: blur | none | (no blur) | Considered backdrop-filter blur on outside probes. Skip: extra paint cost during the most performance-sensitive interaction in the app. Opacity drop alone communicates the dim-out. |
| Region appearance | `--region-border` | `1px dashed var(--color-pending)` | Already implemented. Keep dashed; the dashed style is what reads "selection in progress" rather than "shape on screen". |
| Region fill | (already declared) | `color-mix(in srgb, var(--color-accent) 8%, transparent)` | 8% is the floor where the fill is visible without overpowering probes. |

### 2.3 Token additions for §2

```css
@theme {
  --drag-arm-distance:    6px;
  --drag-min-area:        0.0036;       /* world-space, 0..4 */
  --drag-max-area:        2.56;         /* world-space, 0..4 */
  --drag-min-probes:      3;            /* integer count */
  --probe-outside-opacity: 0.55;        /* 0..1 */
  --region-border:        1px dashed var(--color-pending);
  --region-fill:          color-mix(in srgb, var(--color-accent) 8%, transparent);
  --region-shadow-lift:   0 4px 16px rgba(0, 0, 0, 0.4);
  --drag-trail-opacity:   0.35;         /* trailing line cursor → region center */
  --drag-trail-fade-px:   200;          /* line fades to 0 over this distance */
}
```

---

## 3. Drop target choreography

The SpliceTray contains 5 splice primitives (`unlearn`, `reweight`, `smote` aliased as `augment`, `threshold`, `fairlearn` aliased as `constraint`). Each tray tile is a separate drop target with its own hit test, its own attribute-compatibility logic, and its own accept/reject choreography.

### 3.1 Tile states

| State | Z-axis (drag state) | Trigger | Visual |
|---|---|---|---|
| `idle` | no drag in flight | always | Default tray styling. |
| `drag-active` | gesture is in `selecting` or `carrying` | enters from `idle` when gesture transitions out of `arming` | Tile elevates: 1px solid `--color-fg-subtle` border, faint inner glow at `--color-accent-soft`. Reads "I am a possible target." |
| `receptive` | tile is the closest one to cursor AND compatible with region's attribute mix | cursor within `--drop-hit-radius` and tile passes the §3.3 compatibility check | Border becomes `2px solid --color-accent`, background brightens to `--color-elevated`-mix-2%. Magnitude bar pulses (existing `MagnitudeBar` component, add a 1.6s `--probe-pulse-ms`-style cycle). |
| `reject` | tile is closest to cursor but is incompatible with region | cursor within `--drop-hit-radius` and tile fails compatibility check | Border `1px solid --color-bad`, slight desaturation. Cursor changes to `not-allowed` per CSS-cursor constraint. |
| `committing` | pointer-up over a `receptive` tile | exit from `selecting`/`carrying` | Tile fires accept-flash: scale 1.03 → 1, glow flash, see §3.4. |
| `rejected` | pointer-up over a `reject` tile | exit from `carrying` over the same tile | Tile shakes 4px on x for `--dur-quick` (matches `--ease-out` reverse), border pulses `--color-bad`. |

Idle and drag-active are the same hit-test radius (the tile bounding box). Receptive and reject add the larger `--drop-hit-radius`.

### 3.2 Hit-test geometry

```
hit-test = nearest-tile-by-cursor-distance, tie-broken by cursor-inside-bounding-box
distance metric = euclidean from cursor to tile center
threshold = --drop-hit-radius (default 64px)
magnetic-snap distance = --drop-magnet-distance (default 32px)
```

**Magnetic snap** at the closer threshold (`--drop-magnet-distance`): when the cursor is within 32px of a receptive tile's center, the cursor's effective hit-test position is biased toward that tile center by `--drop-magnet-strength` (default 0.5, dimensionless). The cursor itself doesn't move; the calculation does. Effect: fine motor wobble near a tile is forgiven. The user feels the tile "pulling" their selection.

This is how the demo lands without judges fumbling. It's also the pattern used by every well-engineered drag interaction (Figma snap, OS dock magnification, `drei`'s `useCursor`).

### 3.3 Attribute compatibility check

Each splice primitive accepts certain region compositions. Compatibility is determined at the moment the cursor enters the tile's hit-test radius, by inspecting the probes' `protectedAttribute` field inside the region.

| Primitive | Accepts region with | Rejects region with | Why |
|---|---|---|---|
| `unlearn` | any attribute mix | empty region | Removes the offending samples. Always applicable. |
| `reweight` | dominated by one protected attribute (≥70% of detected probes share `protectedAttribute`) | mixed-axis region | Reweighting needs a target group. A region spanning sex and race has no single weight to apply. |
| `augment` (smote) | dominated by one attribute, region density ≥ `--drag-min-probes` × 2 | ultra-sparse | Synthetic generation needs neighbors to interpolate. |
| `threshold` | ≥80% probes have a *continuous* protected-attribute mapping (age, income); semantic check via probe label parsing | regions dominated by categorical attributes (race, sex) | A threshold cut applies to a continuum, not a category. Threshold doesn't make sense for race. |
| `constraint` (fairlearn) | any attribute mix | empty region | Adds a constraint to training. Composable with anything. |

Implementation note: the compatibility check runs at most once per cursor-enter event. Cache the result for the lifetime of `carrying`. Re-run only if the user re-enters `selecting` and changes the region.

The check needs to distinguish categorical from continuous protected attributes, but the current `Probe` type only has `protectedAttribute: 'sex' | 'race'`. **Open question / risk: the threshold primitive has no continuous attribute in scope as of 2026-05-02.** Two options: (a) widen `protectedAttribute` to include `'age'` for fixture purposes, or (b) drop the threshold primitive from the demo cut. Recommend (a) for breadth; flag if Python lane disagrees.

### 3.4 Accept and reject choreography

Accept (commits to `splice-pending`):

```
1. Tile: border 2px → 3px over --dur-quick, --ease-settle (slight overshoot).
2. Tile: glow flash, --color-accent at 50% alpha → 0% over --dur-base, --ease-out.
3. Magnitude bar: fills 0 → magnitude over --dur-base, --ease-out.
4. Region rectangle: scales toward tile center, 1 → 0 over --dur-quick, --ease-in.
5. Trailing line: fades over --dur-quick.
6. SYSTEM lane takes over: ghost overlay starts drawing on the panels.
```

Reject (no-op, just feedback):

```
1. Tile: shake on x, ±4px, 2 cycles over --dur-quick. ease-out then ease-in.
2. Tile: border 1px solid --color-bad → 1px solid --color-border over --dur-base.
3. Region rectangle: falls back, scale 1 → 0.95, opacity 1 → 0 over --dur-base, --ease-in.
4. Trailing line: dissolves with the rectangle.
5. Caption renders near tile: "Threshold splices need a continuous attribute. This region spans race." Auto-dismisses after --dur-event.
6. State returns to idle.
```

### 3.5 How does the user learn which tile fits this region?

Three layers of guidance, in order of legibility:

1. **Receptive vs reject styling tells them at hover time.** They sweep across tiles, only the compatible ones glow. The incompatible ones go red. This is the load-bearing signal.
2. **Tile primitive label and magnitude bar tell them at idle time.** A tile labelled "reweight" with a 30% magnitude bar + the existing copy-via-`splice.label` is enough for a judge to read "this is the gentle reweight". Already in `SpliceTray.tsx`.
3. **Caption on rejection tells them why** if they pick wrong. Paragraph 5 of §3.4 is the "you can't do this here" moment.

No tooltip ever appears proactively. No "drop here to splice" pointer guides. The demo is short; the user learns by trying.

### 3.6 Token additions for §3

```css
@theme {
  --drop-hit-radius:        64px;
  --drop-magnet-distance:   32px;
  --drop-magnet-strength:   0.5;
  --tile-active-border:     1px solid var(--color-fg-subtle);
  --tile-receptive-border:  2px solid var(--color-accent);
  --tile-reject-border:     1px solid var(--color-bad);
  --tile-shake-amplitude:   4px;
}
```

---

## 4. Pickup affordance

The drag starts from the field, which is z-index 0 (the lowest). The overlay sits at z-index 1 above it, the dashboard panels at z-index 2 above that. The overlay captures pointer events; the field is `pointer-events: none` (already declared). The user has to feel that the field is grabbable despite living below the panels.

### 4.1 The cursor

Pywebview cursor is constrained to standard CSS cursors: `auto`, `default`, `pointer`, `crosshair`, `grab`, `grabbing`, `move`, `text`, `not-allowed`, etc. No custom images, no SVG cursors (pywebview's WKWebView accepts CSS `url()` cursors but they fail in some macOS releases — confirmed dropping back to `crosshair` in production).

| Phase | Cursor |
|---|---|
| Idle, hovering field overlay | `crosshair` (already declared) |
| Arming | `crosshair` |
| Selecting | `crosshair` |
| Carrying | `grabbing` |
| Hovering tile in `receptive` state during carrying | `grabbing` |
| Hovering tile in `reject` state during carrying | `not-allowed` |
| Idle, hovering a tile | `pointer` (existing button behavior) |

Note: `grab` is the "you can pick this up" hint. We don't use it on the field because the entire field is grabbable; if the cursor is on the overlay, it can drag. `crosshair` already implies "select region", which is more accurate than `grab`.

### 4.2 The probe-cluster halo (proximity affordance)

The field needs a visible "yes, you can grab here" signal beyond cursor-style. When the cursor hovers over a dense probe cluster, the cluster brightens slightly. This is the field saying "I see you".

Spec:

- Define **cluster** as: any 0.15-world-radius circle around the cursor that contains ≥3 probes. (`--drag-min-probes` matches the splice min.)
- When the cursor enters the field overlay, run a per-frame check: count probes within radius. If ≥3, the probes inside the radius brighten to 1.1× emissive intensity (or, in reduced-motion mode, color jumps to `--probe-evaluating` for the cluster).
- When cursor exits or count drops below 3, ramp back over `--dur-quick`.
- **Throttle**: every 4 frames (~67ms at 60fps). Per-frame point-in-radius for 220 probes is cheap, but we don't need 60Hz update on a hover affordance.

This is the "field signals receptiveness back to you". Pairs with the cursor's `crosshair`. Together they read: "you are in a place where you can grab."

### 4.3 Modifier key — explicitly NOT required

Considered: hold Shift to drag, otherwise the overlay passes pointer events through to panels. Rejected because:

- The dashboard panels do not need pointer events on their interior surfaces during a drag (selection happens via tray clicks, not panel clicks during drag).
- A modifier requirement is a barrier to first-time legibility. The judge has 90 seconds.
- WKWebView does fire keyboard modifiers correctly on pointer events, so this would be technically possible. The constraint is UX, not implementation.

The overlay always captures pointer events when the field is the active surface. This is fine because the panels' own interactions (click to select for inspector) live above the overlay at z-index 2, and the overlay's `pointer-events: auto` only applies when the cursor is over the field's bounding rect, not over a panel.

**Verify**: confirm panels' z-index 2 vs overlay z-index 1 ordering means clicks on panels don't get captured by the overlay. If they do, the fix is `pointer-events: none` on the overlay-when-cursor-is-over-a-panel, computed in JS via `elementsFromPoint`. Alternative: shrink the overlay's bounding rect to the field-only region (excluding tray, inspector, timeline). Recommend the second; cleaner.

### 4.4 Token additions for §4

```css
@theme {
  --cluster-detect-radius:  0.15;       /* world-space */
  --cluster-min-probes:     3;          /* integer */
  --cluster-bright-factor:  1.1;        /* multiplicative on probe glow */
  --cluster-throttle-ms:    67;         /* roughly every 4 frames */
}
```

---

## 5. Mid-drag preview (forecast on the field)

During `selecting` and `carrying`, the user benefits from seeing what the splice will *do* before committing. system.md §1 introduces a `pending` state in the reducer (post-commit). DRAG-DROP's job is to show a *pre-pending* forecast — a hint of the result, computed on-the-fly, before the user releases.

### 5.1 What the forecast shows

The probes inside the region are projected through the splice the cursor is currently hovering. Each probe gets a "post-splice prediction" ghost: a faint second mesh at the probe's "would-be" location.

| Cursor target | Probes inside region show |
|---|---|
| Over field (no tile yet) | No forecast. Just the live probe color migration. |
| Over `unlearn` tile | Each probe inside region fades to 30% opacity. Reads "these go away". |
| Over `reweight` tile | Each probe inside region adds a faint orbit dot at the same x,y, color `--probe-spliced`, opacity 0.4. Reads "weights shift but probes stay". |
| Over `augment` tile | Each probe spawns a ghost neighbor at +0.05 random offset, faint, color `--probe-spliced`. Reads "more samples like these". |
| Over `threshold` tile | Probes split into two visual groups by a horizontal line at the cursor's y-coord; above-line probes brighten, below-line probes dim. Reads "cut here". |
| Over `constraint` tile | Each probe gains a pulsing 0.5-radius outline. Reads "constrained". |

These are all visual hints, not actual computed splice results (the real splice runs only on commit). For phase-1 fixtures, the visual is **purely decorative** — it indicates direction, not magnitude. **Lower-confidence: I have not validated whether the forecast adds enough demo value to justify implementation cost.** Default ship-cut: implement only the unlearn and reweight forecasts, drop the rest. Those are the two most demo-likely splice picks.

### 5.2 Cancellation

If the cursor moves off the tile, the forecast unwinds over `--dur-quick`. If the cursor moves to a different tile, cross-fade between forecasts over `--dur-quick`.

### 5.3 Coordination with system.md `pending` state

The forecast is **not** the same as system.md's `pending` ghost. Distinction:

| | DRAG-DROP forecast | SYSTEM pending ghost |
|---|---|---|
| Lives on | probe field, inside the region | bento panels, all five waves |
| Triggers when | cursor enters a tile during `carrying` | `pointerup` over a tile (commit fires) |
| Persists until | cursor leaves tile or commit | reducer's `accept`/`reject` |
| Computed how | static visual hint | real `applySplice(head, splice)` result |
| Token color | `--probe-spliced` | `--color-ghost` on panel paths |

The two never run simultaneously: forecast lives during `carrying`, ghost lives during `splice-pending`. State machine separation already in the system.md state diagram.

### 5.4 Token additions for §5

```css
@theme {
  --forecast-opacity:       0.4;
  --forecast-cross-ms:      var(--dur-quick);
  --forecast-orbit-radius:  0.02;       /* world-space, for reweight orbits */
  --forecast-spawn-spread:  0.05;       /* world-space, for augment ghosts */
}
```

---

## 6. Release / commit / undo

### 6.1 Drop-to-commit vs drop-to-stage

**Decision: drop-to-stage.** The drop fires `stage(splice)`, which moves the system into `splice-pending` per the SYSTEM state machine. Accept happens via the InspectorRail's accept button (or keyboard Enter), not at drop time.

Justification:

- The reducer already has `pending` as a stage, and accept/reject are separate user actions per the system.md three-rule contract. Drop-to-commit would bypass the staged ghost preview, which is the thing that makes Glassbox feel like a tool not a one-shot action.
- The SYSTEM ghost overlay exists exactly to give the user a moment to read the consequence caption before committing.
- Drop-to-stage matches what the SpliceTray click handler already does (`stage(splice, 'tray')` on click). Drag and click should produce the same intermediate state.

The drop is the *gesture's* commit; the system commit is one step further. From the user's perspective, dropping is "I picked this remedy"; clicking accept is "I'm sure".

### 6.2 Undo affordance

**Pick: timeline scrub backward + Cmd-Z keyboard shortcut.**

Three options considered:

| Option | Pros | Cons |
|---|---|---|
| Timeline scrub backward (existing) | Already present per system.md §4.6. Visible and demo-legible. | Requires the user to find the timeline. |
| Cmd-Z keyboard shortcut | Universal. Costs nothing to add. | Invisible. New users don't know it's there. |
| Splice-tile click-again to remove | Tactile: the same affordance toggles. | Only works if the user remembers which tile. Breaks if they switch tiles. |

Combine the first two: timeline scrub is the canonical undo for the demo (because it's visible), Cmd-Z is the keyboard accelerator for power-use. Drop the splice-tile-click-again option because it conflicts with §1.5 (clicking a tile during idle is the keyboard-equivalent splice gesture).

Cmd-Z behavior: dispatches `dispatch({ kind: 'scrub', nodeId: <prev-head> })`. If the head is already `baseline` and there's nothing to undo, no-op silently. Cmd-Shift-Z = redo (forward scrub).

The reducer's existing `scrub` action handles this; DRAG-DROP just wires the keybinding.

### 6.3 Commit visual signature (recap, owned by SYSTEM)

When the user releases over a `receptive` tile:

1. Tile fires accept choreography (§3.4).
2. Region rectangle scales toward tile center and dissolves.
3. **SYSTEM takes over**: ghost overlay starts drawing on panels per system.md §4.3.
4. InspectorRail slides in.
5. Timeline pending dot appears.

DRAG-DROP's visible work ends at step 2. Steps 3–5 are SYSTEM's contract. This split keeps the drag gesture from getting tangled with the dashboard's pending logic.

---

## 7. Cross-lane integration with system.md

The drag gesture creates several concurrent visual changes (rectangle, probe color migration, panel dim, field dampen, tile glow, trailing line) that overlap with system.md's named-tween registry. Per system.md §3.4 and §7-5, every cancellable tween must carry an ID.

### 7.1 Named tween IDs introduced by DRAG-DROP

| Tween ID | Owner | Purpose | Cancellable on |
|---|---|---|---|
| `drag.region.draw` | SpliceGesture | rectangle resize during selecting | gesture exit |
| `drag.region.lift` | SpliceGesture | rectangle elevation on enter `carrying` | gesture exit |
| `drag.region.fall` | SpliceGesture | rectangle fall-back on bad release | new drag start |
| `drag.region.absorb` | SpliceGesture | rectangle dissolves into tile on commit | n/a (terminal) |
| `drag.trail.line` | SpliceGesture | trailing line opacity + length | drag end |
| `drag.field.outside-dim` | ProbeField | probes outside region opacity ramp | drag end |
| `drag.cluster.halo` | ProbeField | hover-cluster brightening | cursor leaves cluster |
| `drag.tile.<id>.active` | SpliceTray | tile drag-active state | drag end |
| `drag.tile.<id>.receptive` | SpliceTray | tile receptive state | cursor leaves tile |
| `drag.tile.<id>.reject` | SpliceTray | tile reject state | cursor leaves tile |
| `drag.tile.<id>.shake` | SpliceTray | reject shake choreography | n/a (one-shot, --dur-quick) |
| `drag.tile.<id>.accept-flash` | SpliceTray | accept choreography | n/a (one-shot) |
| `drag.forecast.<probe-id>` | ProbeField | per-probe forecast hint | cursor leaves tile |

### 7.2 Conflict resolution

Cases where DRAG-DROP tweens collide with SYSTEM tweens:

| Scenario | Resolution |
|---|---|
| Probe transitions to `detected` mid-drag (probing event) | Probe pulse runs in parallel with drag color migration. The two compete for the probe's color. **Rule: drag wins.** Pulse is suppressed for probes inside the region during `selecting`/`carrying`. Pulse for outside probes continues. |
| Drag in flight when previous splice commits | Not possible — `splice-pending` blocks the field overlay. SpliceGesture should disable `pointerdown` while `pending` is non-null. |
| Reduced-motion + drag | All tweens above degrade per §8. Rectangle still draws (geometry, not motion). No magnetic snap. No forecast cross-fade. |
| GSAP vs motion/react ownership | DRAG-DROP uses motion/react for the rectangle and tile choreography (DOM-side), and the existing per-frame lerp pattern in `useFrame` for probe migrations (R3F-side). No GSAP. This matches system.md §6's split: GSAP owns DOM choreography for *system-level* edges; motion/react for component-level. Drag is component-level. |

### 7.3 The choreography registry

system.md §7-5 calls for `lib/choreography.ts` with `kill(id)` and `play(id, fn)`. DRAG-DROP integrates by using these methods if the registry exists; otherwise falls back to per-element `gsap.killTweensOf(target)` and motion/react's `useAnimate` controllers.

For phase-1 ship: ship without the registry. Use motion/react's `useAnimate`'s built-in handle-based control (returned `[scope, animate]` tuple), and r3f's per-frame lerp. The named-tween IDs in §7.1 stay as documentation contracts, not runtime IDs. When the registry lands, swap the controllers in.

---

## 8. Reduced-motion and accessibility

Per `globals.css`, the blanket CSS reduced-motion rule already kills CSS transitions. JS-driven motion needs explicit per-edge degradation.

### 8.1 Reduced-motion drag spec

| Edge | Full motion | Reduced motion |
|---|---|---|
| Arm | (no animation) | (same) |
| Region rectangle draw | per-frame size update | (same — geometry, not motion) |
| Region lift on `carrying` | translateY(-2px) + box-shadow over `--dur-quick` | snap to lifted state |
| Trailing line | opacity ramps with cursor distance | line jumps fully on, no fade |
| Probes outside dim | opacity ramp over `--dur-quick` | opacity set instantly |
| Probes inside color migration | per-frame lerp | color set instantly to `--probe-spliced` |
| Tile state transitions | border + glow tween over `--dur-quick` | border swap instant |
| Magnetic snap | cursor position biased over `--drop-magnet-distance` | no snap; raw cursor position only |
| Region dissolve on commit | scale + opacity over `--dur-quick` | opacity 1 → 0 instant |
| Forecast hints | cross-fade between tiles | switch instantly between tiles |
| Reject shake | x oscillation 4px | no oscillation; border color swap instant |

The geometry of the rectangle and the tile hit-test logic are unchanged. The user gets the same gesture; the pleasure is removed.

### 8.2 Keyboard alternative for the splice gesture

A judge with motor constraints, or a power user, must be able to splice without the mouse drag. Spec:

```
1. Tab into the field overlay (focusable element with tabIndex={0}).
2. Arrow keys move a "focus probe" — a single probe highlighted as the
   keyboard cursor. Arrows pick the probe nearest in that direction.
3. Shift+arrow extends a focus region from the focus probe.
4. Enter on a focused region activates "tile selection mode":
   focus moves to the SpliceTray, arrow keys cycle tiles.
5. Enter on a tile fires stage(splice) with the focused region.
6. Escape at any point cancels.
```

Visual signature in keyboard mode:

- Focus probe gets a 2px outline at `--color-accent`, larger than hover halo.
- Focus region renders identically to the drag rectangle.
- Tile selection mode adds a 2px focus ring on the active tile (already covered by the global `*:focus-visible` rule in `globals.css`).
- A small monospace hint at field bottom: `↑↓←→ extend  Enter pick remedy  Esc cancel`. Render only when keyboard navigation is detected (first Tab keypress sets a `data-keyboard-active` flag on `<body>`).

The keyboard path doesn't have a forecast preview (forecast is hover-driven). That's a deliberate trade-off; full parity is overspec for 36 hours.

### 8.3 Screen reader

Each tile gets `aria-label="<primitive> splice: <label>. magnitude <N>%"`. The field overlay gets `role="application" aria-label="Probe field, drag to select region. Arrow keys for keyboard splice."`. The region announces itself on commit: `aria-live="polite"` toast: "Region of N probes spliced via <splice label>."

### 8.4 Token additions for §8

```css
@theme {
  --keyboard-focus-outline: 2px solid var(--color-accent);
  --keyboard-focus-region:  var(--region-border);
  --keyboard-hint-color:    var(--color-fg-subtle);
}
```

---

## 9. Open questions and risks

1. **Threshold primitive needs a continuous attribute.** §3.3 assumes `protectedAttribute` can be `'age'` for the threshold splice's compatibility check. Current type is `'sex' | 'race'` only. Options: widen the union to include `'age'` (low risk, fixture work), or drop threshold from the demo cut. Recommend widen.

2. **Magnetic snap implementation is a fudge layer.** §3.2 biases the hit-test computation toward tile centers. This creates a very small region around tile centers where the cursor's "logical" position differs from its rendered position. Probably invisible at 32px; verify on the actual machine. Lower-confidence — I cannot test on WKWebView from this environment.

3. **Forecast preview implementation cost.** §5 specifies five forecast variants. Realistic phase-1 cut: ship `unlearn` and `reweight` forecasts only; drop the rest. Validate at T-1h.

4. **z-index ordering between overlay and panels.** §4.3 raises the question of whether a click on a bento panel during idle gets captured by the overlay. The fix is to shrink the overlay's bounding rect to exclude panels (or set `pointer-events: none` while cursor is over a panel). Recommend the rect-shrink path; cleaner and easier to reason about.

5. **Pywebview cursor: `not-allowed` may render as default on some macOS releases.** WKWebView 16.x has occasional gaps in CSS cursor support. Lower-confidence: I haven't confirmed `not-allowed` renders on macOS Sonoma 14.6+. If it doesn't, the fallback for the reject state is a stronger visual on the tile (border thickness ↑, `--color-bad` flash). Both signals exist already; cursor is auxiliary.

6. **`Escape`-to-cancel during commit.** §1.6 says Escape cancels at any point. But the moment between `pointerup` and dispatch is one frame. Cancelling during this frame is theoretically possible via keypress but probably never observable. Treat the dispatch as atomic; Escape after `committing` enters does nothing. Document.

7. **Focus probe nearest-neighbor implementation.** §8.2 uses arrow-key direction to pick the nearest probe in that direction. The naive "smallest x-distance" or "smallest y-distance" gets wrong answers when probes are clustered. Recommend a directional-cone metric (probes within ±45° of arrow direction, then nearest). This is a small implementation detail; flag for the keyboard implementation pass.

8. **Cursor outside field bounds during `selecting`.** What happens if the user presses down inside the field, then drags off the field while still in `selecting` (didn't reach `carrying`)? Spec says transition to `carrying` is on `pointerout`. Edge case: pointer leaves the field via the *bottom* edge (timeline strip below) vs the *right* edge (inspector). Both should trigger `carrying`. The pointer-out detection is on the overlay rect, not on individual edges. Confirm.

9. **Multi-touch / pinch on macOS trackpad during drag.** Pywebview WKWebView passes through pinch/zoom gestures. If the user pinches mid-drag, the field could zoom. Recommend disabling page zoom in pywebview window config (`webview.create_window(... zoomable=False ...)`); needs Python-lane confirmation. Without that, drag could appear to "stretch the rectangle" because the field zoomed. Flag.

10. **Demo readability of cluster-halo affordance.** §4.2 brightens probes near the cursor when ≥3 are in radius. On a dense field this could mean the cursor is always trailed by a halo, which loses signal. Recommend lowering opacity contribution (1.05× instead of 1.1×) at high probe density. Calibrate at T-1h with the real fixture density.

11. **Drop-to-stage vs drop-to-commit demo flow.** §6.1 picks drop-to-stage. The 90-second demo then has two clicks per splice (drop, then accept). Total = 2 splices × 2 actions = 4 actions plus narration. Tight but doable. Alternative for a tighter cut: drop-to-commit on Cmd-held drop, drop-to-stage on plain drop. Adds complexity; default to drop-to-stage everywhere unless rehearsal proves otherwise.
