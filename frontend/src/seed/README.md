# Seed data

Temporary fake-data normalization layer. Everything in this folder is replaced
the moment a real upstream is wired.

## What lives here

| File | Replaced by |
|---|---|
| `probe-clusters.json` | Backboard prober agent output (live multi-agent stream) |
| `probe-labels.json`   | Backboard prober's synthetic counterfactual generator |

## Drop signal

When `VITE_BACKBOARD_LIVE=true` and the Python BB client is wired in
`glassbox/backboard.py`, importers should fall through to the live stream and
seed files become a dev-only fallback. Do NOT delete this folder until the
fixture-fallback path in `lib/proberAgent.ts` is also removed.

## Rule

No hardcoded sample data inside `lib/`, `state/`, or `particles/` source.
Anything synthetic that mimics upstream output goes here.
