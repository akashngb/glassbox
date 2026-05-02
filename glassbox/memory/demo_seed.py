"""Pre-populate ~/.glassbox with believable audit events for a demo run.

Use this so the History drawer is already populated the moment Glassbox boots —
no live click-through required during a presentation.

Usage:
    python3 -m glassbox.memory.demo_seed                 # seeds for cwd
    python3 -m glassbox.memory.demo_seed PATH            # seeds for PATH
    python3 -m glassbox.memory.demo_seed PATH --reset    # wipes prior history first

The project_path you pass MUST match the path Glassbox boots against (the
absolute path of the model file, or cwd when no model is given), because the
local session id is derived from sha256(abspath(project_path)).
"""
from __future__ import annotations

import argparse
import os
import sys
import time

from glassbox.memory import SessionMemory
from glassbox.memory.session import _glassbox_home


_NOW = time.time()
_HOUR = 3600

# Backdated so the toast shows a believable "Resumed from <date>".
_FAKE_EVENTS: list[tuple[float, str, dict]] = [
    (_NOW - 2 * _HOUR,      "session_started",
        {"project_path": "<filled-in>", "baseline_metrics": {"dpd": 0.18, "dir": 0.42}}),
    (_NOW - 2 * _HOUR + 90, "diff_accepted",
        {"diff_id": "unlearn-male-high-conf",
         "summary": "Unlearn high-confidence male positives",
         "file_paths": ["compas_model.py"]}),
    (_NOW - 2 * _HOUR + 240, "param_changed",
        {"node_id": "unlearn-male-high-conf",
         "param_name": "confidence",
         "old_value": 0.75,
         "new_value": 0.80}),
    (_NOW - 2 * _HOUR + 420, "diff_rejected",
        {"diff_id": "smote-race",
         "summary": "SMOTE oversample minority race",
         "reason": "introduced too much variance in DPD"}),
    (_NOW - _HOUR,          "diff_accepted",
        {"diff_id": "reweight-sex",
         "summary": "Rebalance sample weights by sex",
         "file_paths": ["compas_model.py"]}),
    (_NOW - _HOUR + 60,     "diff_accepted",
        {"diff_id": "threshold-sex",
         "summary": "Per-group decision threshold (sex)",
         "file_paths": ["compas_model.py"]}),
]


def seed(project_path: str, reset: bool) -> None:
    project_path = os.path.abspath(project_path)
    sm = SessionMemory(project_path)

    if reset and sm._jsonl_path.exists():
        sm._jsonl_path.unlink()
        print(f"  reset {sm._jsonl_path}")

    sm.resume_or_create()

    # Inject events with manually-set timestamps by writing directly to the jsonl.
    # We bypass log_event() so the timestamps are backdated.
    for ts, event_type, payload in _FAKE_EVENTS:
        if event_type == "session_started":
            payload = {**payload, "project_path": project_path}
        event = {"event_type": event_type, "payload": payload, "timestamp": ts}
        sm._append_local(event)

    sm.shutdown()

    print(f"seeded {len(_FAKE_EVENTS)} events")
    print(f"  project_path:     {project_path}")
    print(f"  local_session_id: {sm.local_session_id}")
    print(f"  jsonl:            {sm._jsonl_path}")
    print(f"  glassbox home:    {_glassbox_home()}")


def main() -> int:
    parser = argparse.ArgumentParser(prog="glassbox.memory.demo_seed")
    parser.add_argument("project_path", nargs="?", default=os.getcwd(),
                        help="Project path to seed history for (default: cwd).")
    parser.add_argument("--reset", action="store_true",
                        help="Wipe existing history for this project before seeding.")
    args = parser.parse_args()
    seed(args.project_path, args.reset)
    return 0


if __name__ == "__main__":
    sys.exit(main())
