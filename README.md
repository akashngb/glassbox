# Glassbox

A Python tool that opens a native window showing where a trained model's bias hides, with bento-box wave visualizations you can drag-splice to retrain.

## What you'll see

A 1280×820 native window. Top-bar command palette, a tray of splice tiles on the left (unlearn / reweight / smote / threshold / fairlearn), a dashboard of bento panels in the middle (DPD, DIR, EOD, accuracy by group, bias flags) over a live WebGL probe field of the model's adversarial-prober output, an inspector rail on the right, and a timeline along the bottom.

Drag a region of the probe field onto a tray tile → ghost waveforms preview the splice → accept commits, reject reverts. Cmd-Z scrubs back.

In dev mode the data is fixtures (since `glassbox/api.py` isn't wired to `sisa.py` yet); in production it'll surface real COMPAS recidivism metrics off `bias_report.json`.

## Quickstart (first time on this machine)

```bash
cd ~/glassbox
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
.venv/bin/python -m glassbox     # production bundle, single command
```

Or for live-reload while iterating on the frontend, use the two-terminal flow below.

## Development (live reload)

Two terminals.

```bash
# Terminal 1 — frontend dev server (Vite)
cd frontend
npm install                       # first time only
npm run dev                       # serves http://localhost:5173

# Terminal 2 — pywebview window pointing at the dev server
cd ~/glassbox
source .venv/bin/activate         # or use .venv/bin/python directly
python -m glassbox --dev          # window loads localhost:5173 with HMR
```

Save a `.tsx` and the pywebview window hot-reloads.

## Production bundle

```bash
cd frontend && npm run build      # outputs to glassbox/frontend/
cd .. && .venv/bin/python -m glassbox    # no --dev: loads the static bundle
```

The bundle is committed to `glassbox/frontend/` so `pip install` ships it.

## Stack

- **Python:** pywebview 6.x, scikit-learn, pandas, imbalanced-learn (SMOTE), Python ≥ 3.10
- **Frontend:** Vite 8 + React 19 + TypeScript 6 + Tailwind 4 + Motion 12 + GSAP 3.15 + three.js / @react-three/fiber 9 (probe field)
- **Algorithm:** SISA training (Bourtoule et al. 2020) — sharded ensemble that lets us unlearn data points without full retraining
- **Dataset:** COMPAS recidivism (ProPublica analysis files in `compas-repo/`)

## Project layout

```
glassbox/
├── pyproject.toml
├── sisa.py                      # SISA pipeline, COMPAS-wired; writes bias_report.json
├── compas_model.py              # one-shot GradientBoosting trainer; writes compas_metrics.json
├── compas_metrics.json          # baseline GB metrics (accuracy, AUC, TPR/FPR by group)
├── compas_high_risk.csv         # high-risk subset from compas_model.py
├── compas-repo/                 # ProPublica COMPAS clone (CSVs, ipynbs, sqlite)
├── glassbox/                    # package wrapping sisa.py + window
│   ├── __init__.py
│   ├── __main__.py
│   ├── window.py                # pywebview boot
│   ├── api.py                   # GlassboxAPI exposed to JS via js_api
│   ├── fixtures/                # fixture analyses for fixture-mode demo
│   └── frontend/                # built Vite bundle (committed)
└── frontend/                    # Vite + React + TS source
    ├── src/components/          # Panel, SpliceTile, Wave, Caption, etc.
    ├── src/particles/           # ProbeField (R3F) + SpliceGesture overlay
    ├── src/state/               # GlassboxProvider, useReducer state
    ├── src/lib/                 # tokens, pywebview bridge, useAnalysis hook
    └── src/styles/globals.css   # @theme tokens (single source of truth)
```

## Closing stuck ports

Vite (5173), HMR (5174), and the bottle.py server pywebview spawns occasionally hang after a crash or reload. Quick recovery:

```bash
# See what's holding a port (5173 = Vite default)
lsof -nP -iTCP:5173 -sTCP:LISTEN

# Kill the process holding a single port
lsof -ti:5173 | xargs kill -9

# Kill the whole common range (Vite + HMR + a couple bottle fallbacks)
for port in 5173 5174 5175 8000 8080; do
  lsof -ti:$port | xargs kill -9 2>/dev/null
done

# Nuke every Vite / pywebview / glassbox process in one shot
pkill -f vite
pkill -f "python.*glassbox"
pkill -f pywebview
```

If `npm run dev` reports `EADDRINUSE` on startup, run the kill block above and retry. If pywebview opens to a blank window, check that the vite dev server in Terminal 1 is still up — `--dev` loads `http://localhost:5173`, not the bundled file.

If the window opens but the panels show 0/0/0 with no data, check the JS console (Cmd-Opt-I in pywebview debug mode). The pywebview bridge waits for the `pywebviewready` event before calling `baseline()` / `list_splices()` — if those calls fail, the GUI silently falls back to fixtures from `frontend/src/data/fixtures.ts`.
