# `glassbox.memory` — persistent audit sessions

This module makes Glassbox audits **resumable across runs**. Every accept,
reject, and param change is logged once locally and best-effort synced to
Backboard.io so the same project always reopens with its full history.

## What it does

When you run `glassbox.open("models/adult.pkl")`:

1. The absolute project path is hashed to a stable `local_session_id`
   (`sha256(abspath)[:16]`).
2. `~/.glassbox/threads.json` is consulted for an existing entry. If found,
   the prior session resumes; otherwise a new one is created.
3. A `session_started` event is appended to the project's jsonl log.
4. The UI shows a toast (`Resumed from <date>. X accepted · Y rejected · Z
   param changes.`) and the History drawer is populated from disk.

After that, every Accept / Reject / param change in the UI calls
`SessionMemory.log_event(...)`, which:

- Synchronously appends one line to the local jsonl (the source of truth).
- Schedules a non-blocking Backboard sync on a background worker.

## Architecture: local-first, fail-open

```
   UI (Accept/Reject)
         │
         ▼
  SessionMemory.log_event
         │
   ┌─────┴─────┐
   ▼           ▼
local jsonl   background ThreadPoolExecutor
(canonical)         │
                    ▼
            Backboard.io Memory
            (best-effort sync)
```

The local jsonl is **always** the source of truth.

- No `BACKBOARD_API_KEY`?  Local-only, app works unchanged.
- `backboard-sdk` not installed?  Local-only, app works unchanged.
- Backboard is down?  Local-only this run; pending events flush on the next
  successful connect via a `synced_count` cursor stored in `threads.json`.

Reads (`get_history`, `get_accepted_diffs`, etc.) always come off the local
file — the UI never blocks on a network call.

## Backboard mapping

Backboard threads are conversational (writes invoke an LLM); Backboard
**Memory** is structured key/value with metadata, no LLM in the loop. So
events are logged as Memory entries, not thread messages:

| Glassbox concept | Backboard primitive |
|------------------|---------------------|
| project          | one Assistant per project (`glassbox::<basename>::<local_id>`) |
| audit event      | one `add_memory(assistant_id, content, metadata={event_type, timestamp})` |

Thread IDs are server-generated UUIDs; the `~/.glassbox/threads.json` file is
the local mapping from `project_path → assistant_id`.

## Storage layout

```
$GLASSBOX_HOME/                       # default: ~/.glassbox
├── threads.json                      # project_path -> {assistant_id, local_session_id, synced_count}
└── sessions/
    └── <local_session_id>.jsonl      # one event per line, append-only
```

Each line in the jsonl:

```json
{"event_type": "diff_accepted", "payload": {"diff_id": "unlearn-male-high-conf", "summary": "...", "file_paths": [...]}, "timestamp": 1714671820.42}
```

Event types currently emitted:
- `session_started` — `{project_path, baseline_metrics}`
- `diff_accepted` — `{diff_id, summary, file_paths}`
- `diff_rejected` — `{diff_id, summary, reason}`
- `param_changed` — `{node_id, param_name, old_value, new_value}`
- `agent_run` — `{trigger, shards_affected, outcome}` (reserved; not yet emitted)

## Files

| File              | What it is |
|-------------------|------------|
| `session.py`      | `SessionMemory` class — the entire persistence layer. |
| `demo_seed.py`    | Pre-populates `~/.glassbox` with believable audit history for demos. |
| `__init__.py`     | Re-exports `SessionMemory`. |

## Demo seed — populate the History drawer before booting

```bash
# seed for cwd (matches `python3 -m glassbox` with no model_path)
python3 -m glassbox.memory.demo_seed

# seed for a specific model path
python3 -m glassbox.memory.demo_seed compas_model.py

# wipe and re-seed
python3 -m glassbox.memory.demo_seed compas_model.py --reset
```

The script writes 6 backdated events (1 session_started, 3 accepts, 1 reject,
1 param change) under timestamps from ~2 hours ago up to ~1 hour ago. When
Glassbox boots against the same path, the toast reads:

> *Resumed audit from May 2, 16:14. 3 accepted · 1 rejected · 1 param change.*

…and the drawer is populated immediately. No live click-through needed.

**The seed `project_path` must match the path Glassbox boots against** —
that's how the local session id is derived. If you seed for cwd but boot
with `python3 -m glassbox compas_model.py`, the ids won't match and the
drawer will be empty. Either seed and boot the same way, or pass the same
explicit path to both.

## Environment

| Var | Purpose |
|-----|---------|
| `BACKBOARD_API_KEY` | Enables Backboard sync. Read from `.env` at boot. |
| `GLASSBOX_HOME`     | Override the storage root. Defaults to `~/.glassbox`. Used by tests. |

## Tests

```bash
python3 test_session_memory.py
```

The test runs without a network and without the SDK installed. It writes 3
events, simulates a process restart by instantiating a fresh `SessionMemory`
for the same project path, and confirms all 3 events are restored verbatim.
