# Glassbox — entrypoints, flows, refresh map

## Process entrypoints

| Command | What happens | When to use |
|---|---|---|
| `python -m glassbox` | Boots pywebview window with bundled frontend (`glassbox/frontend/`). No model audit. Falls back to fixtures if `bias_report.json` missing. | Production / demo. |
| `python -m glassbox --dev` | Boots pywebview pointed at Vite dev server (`localhost:5173`). HMR live. | Active frontend iteration. |
| `python -m glassbox <model.pkl>` | Runs sisa.py audit on the model first, writes `bias_report.json` and `retune.json`, then boots window with live data. | Try a real model end-to-end. |
| `python sisa.py` | Standalone audit. Writes `bias_report.json`. Trains 5 SISA shards × 5 slices, computes fairness, dumps recommendations. | Regenerate audit when you change CANDIDATE_SCORE, MAX_UNLEARN_PCT, etc. |
| `python retune.py` | Reads `bias_report.json`, predicts hyperparam tweaks. Writes `retune.json`. | Get retune suggestion after sisa run. |
| `python fix_message.py` | Reads `bias_report.json` + `retune.json`, calls Gemini, writes `fix_message.md`. Needs `GEMINI_API_KEY`. | Generate plain-English fix narrative for InspectorRail. |
| `python compas_model.py` / `python adult_model.py` | Trains baseline GradientBoostingClassifier on COMPAS / UCI Adult. Writes `<name>_metrics.json` + `<name>_high_risk.csv`. | Reproduce the sample models. |
| `cd frontend && npm run dev` | Vite dev server only. No pywebview. Use with `python -m glassbox --dev` from a second terminal. | Frontend-only iteration. |
| `cd frontend && npm run build` | Builds production bundle to `glassbox/frontend/`. | Before shipping. |

## Window → bridge → backend (data flow)

```
┌─────────────────────────────────────────────────────────────────┐
│  pywebview window (1280×820, WKWebView, dark)                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Vite/React app  ─────────────►  window.pywebview.api       ││
│  │                                          │                  ││
│  └──────────────────────────────────────────┼──────────────────┘│
└───────────────────────────────────────────── │ ─────────────────┘
                                               ▼
                              GlassboxAPI (glassbox/api.py)
                                               │
       ┌────────────────────────┬──────────────┼──────────────────────┐
       ▼                        ▼              ▼                      ▼
  bias_report()             baseline()    apply_splice()        session_*
  retune()                                                      (memory/session.py)
  fix_message()                                                       │
  model_identity()                                                    ▼
       │                                                       per-project jsonl
       ▼                                                       (best-effort
  bias_report.json                                              Backboard.io sync)
  retune.json
  fix_message.md
       ▲
       │
  sisa.py / retune.py / fix_message.py
       ▲
       │
  compas-scores-raw.csv  (or other model.pkl)
```

## State flows in the frontend

### Boot

1. `main.tsx` → `initGsap()` registers Observer + CustomEase plugins, defines `settle` and `dampen` eases.
2. React renders `<SessionProvider><GlassboxProvider><App /></GlassboxProvider></SessionProvider>`.
3. `SceneRoot` runs the boot timeline (probe field opacity ramp → command bar + tray fade-in → bento panels y/opacity → inspector → timeline). Cleanup in StrictMode dev safely settles to visible state.
4. `GlassboxProvider` reducer initializes with `timeline: [{ id: 'baseline', analysis: <baseline> }]`. Calls `pywebview.baseline()` to populate the head node.
5. `SessionProvider` calls `pywebview.sessionInfo()`. If a previous session exists, surfaces `ResumeToast`.
6. `InspectorRail` calls `pywebview.modelIdentity()` once on mount. Empty state shows "COMPAS recidivism · N samples · acc X · K bias flags".

### Splice → preview → accept (the demo loop)

1. User drags a region across the probe field, OR drops a `SpliceTile` onto the canvas, OR submits text in `CommandBar`.
2. `SpliceGesture` (or tile drop handler) calls `useAnalysis().stage(splice)`.
3. Reducer `stage` action calls `applySplice(head, splice)` → routes through `pywebview.applySplice()` → `GlassboxAPI.apply_splice()`.
4. Returned `Analysis` becomes the `pending.ghost`. `pending.caption` is the consequence-framed text.
5. BentoCanvas panels overlay the ghost wave on top of the baseline wave (motion.path morph).
6. InspectorRail slides in with the splice label, full caption, Accept / Reject.
7. **Accept**: dispatch `accept` → reducer pushes ghost to timeline, clears pending. Also calls `pywebview.acceptSplice(splice.id, ...)` which logs to SessionMemory jsonl.
8. **Reject**: dispatch `reject` → reducer drops pending. Also calls `pywebview.rejectSplice(splice.id, reason)`.
9. Cmd-Z scrubs back through the timeline. Cmd-Shift-Z restores forward.

### Ambient / background

| Loop | Owner | Cadence | Purpose |
|---|---|---|---|
| `ProbeField` `useFrame` | `@react-three/fiber` | 60fps | Drift + pulse for probe particles. Fixed point count from `--probe-density`. |
| `ProberAgent` (when wired) | `lib/proberAgent.ts` | every 4s | Generates new probe-cluster captions ("flagged 23 samples in age × race"). LIFO into `ProbeCaptionCard`. |
| GSAP boot timeline | `SceneRoot` | one-shot, ~1.1s | Reveals UI on mount. |
| Splice ghost morph | `motion.path` on `Wave.tsx` | one-shot per pending | 0→1 pathLength + d-attribute interpolation. |
| Field state edges | `FieldStateGate` | reactive to reducer | Sets `<body data-scene>` so descendants restyle (pending dampens probe glow, applied flashes). |
| SessionMemory background sync | `glassbox/memory/session.py` worker thread | best-effort | Syncs jsonl events to Backboard.io. |

## Refresh model (when does what re-fetch)

- **`baseline()`**: called once at GlassboxProvider mount. NOT polled. To pick up a new audit, the user has to either restart the window or hit a future "Reload audit" button (out of scope for demo).
- **`apply_splice()`**: called per stage action. Pure function from (head_id, splice) — cached by reducer in the timeline node; never re-called for the same head+splice pair.
- **`model_identity()`**: called once at InspectorRail mount.
- **`session_info()`**: called once at SessionProvider mount.
- **`session_history()`**: called when SessionHistory drawer opens.

No polling. Everything is event-driven, request/response.

## Demo path (the only thing that has to work end-to-end)

```
0:00–0:15  Boot. SceneRoot reveal. ProbeField + RefractionScene (3D cube hero) settle in.
           InspectorRail empty state shows "COMPAS recidivism · 20,245 samples · acc 0.833 · 4 bias flags".
0:15–0:25  ProberAgent flags first cluster — caption appears bottom-left.
           DPD panel border outlines red. Field pulses at cluster.
0:25–0:35  User drags region around cluster. Region label shows probe count.
0:35–0:42  Drop on Reweight tile. Tile flashes accept-color. Ghost wave overlays bias panels.
           InspectorRail slides in with consequence caption.
0:42–0:55  Hit Enter to accept. Field flashes. Spliced probes recolor. Timeline gains a node.
           SessionMemory logs the accept event silently.
0:55–1:10  Second cluster fires. Repeat with a different splice.
1:10–1:25  Cmd-Z scrubs back. Wave morphs in reverse.
1:25–1:30  Ending tableau. Two timeline nodes. Bias flag count dropped from 4 → 2.
```

## Out of scope (deliberately, for the demo)

- Real-time model retraining on splice (uses pre-baked outcomes per splice id).
- Multi-model concurrent loading.
- Undo across sessions.
- VS Code extension surface.
- Auth.
- Mobile / responsive.
