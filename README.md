# Glassbox

A Python tool that opens a native window showing where a trained model's bias hides, with bento-box wave visualizations you can drag-splice to retrain.

## Quickstart

```bash
pip install -e .
python -m glassbox
```

A native window opens. Bento layout, five panels, each a fairness metric on the UCI Adult Census model. Drag a splice from the tray; ghost overlays appear; accept commits; reject reverts.

## Stack

- **Python:** pywebview 5.x, scikit-learn, pandas, imbalanced-learn (SMOTE)
- **Frontend:** Vite + React 18 + TypeScript + Tailwind 4 + Framer Motion
- **Algorithm:** SISA training (Bourtoule et al. 2020) — sharded ensemble that lets us unlearn data points without full retraining

## Project layout

```
glassbox/
├── pyproject.toml
├── sisa.py                      # standalone SISA pipeline (Kevin's)
├── glassbox/                    # package wrapping sisa.py + window
│   ├── __init__.py
│   ├── __main__.py
│   ├── window.py                # pywebview boot
│   ├── api.py                   # Glassbox class exposed to JS via js_api
│   └── fixtures/                # baked bias_report.json variants for demo
└── frontend/                    # Vite + React + TS source
```

## Development

Two terminals.

```bash
# Terminal 1 — frontend
cd frontend
npm install
npm run dev          # opens at http://localhost:5173

# Terminal 2 — python (after frontend is running, for live JS↔Python bridge)
python -m glassbox --dev
```

Production build embeds the frontend bundle inside the package.
