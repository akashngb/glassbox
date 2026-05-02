"""Smoke test for SessionMemory local persistence.

Runs without BACKBOARD_API_KEY — validates that the local jsonl + index file
form a complete, self-sufficient store. Backboard sync is a separate path and
is not exercised here.

Usage:
    python test_session_memory.py
"""
from __future__ import annotations

import os
import sys
import tempfile

# Force the SDK off and pin GLASSBOX_HOME to a tmpdir before importing.
os.environ.pop("BACKBOARD_API_KEY", None)
_TMP = tempfile.mkdtemp(prefix="glassbox-test-")
os.environ["GLASSBOX_HOME"] = _TMP

from glassbox.memory import SessionMemory  # noqa: E402

PROJECT_PATH = "/tmp/fake_project"


def main() -> int:
    sm = SessionMemory(PROJECT_PATH)
    sm.resume_or_create()
    assert sm.resumed is False, "fresh project should not report resumed=True"
    assert sm.prior_summary["total"] == 0

    sm.log_event("diff_accepted", {"diff_id": "splice-a", "summary": "unlearn male", "file_paths": []})
    sm.log_event("diff_rejected", {"diff_id": "splice-b", "summary": "smote race", "reason": "too aggressive"})
    sm.log_event("param_changed", {"node_id": "n1", "param_name": "confidence", "old_value": 0.75, "new_value": 0.80})

    history = sm.get_history()
    assert len(history) == 3, f"expected 3 events, got {len(history)}: {history}"
    assert history[0]["event_type"] == "diff_accepted"
    assert history[1]["event_type"] == "diff_rejected"
    assert history[2]["event_type"] == "param_changed"
    assert history[1]["payload"]["reason"] == "too aggressive"

    assert len(sm.get_accepted_diffs()) == 1
    assert len(sm.get_rejected_diffs()) == 1
    assert len(sm.get_param_history()) == 1

    filtered = sm.get_history(event_types=["diff_accepted", "param_changed"])
    assert [e["event_type"] for e in filtered] == ["diff_accepted", "param_changed"]

    sm.shutdown()

    # Simulate a fresh process with the same project path.
    sm2 = SessionMemory(PROJECT_PATH)
    sm2.resume_or_create()
    assert sm2.resumed is True, "second instance should report resumed=True"
    assert sm2.local_session_id == sm.local_session_id
    assert sm2.prior_summary["total"] == 3
    assert sm2.prior_summary["accepted"] == 1
    assert sm2.prior_summary["rejected"] == 1
    assert sm2.prior_summary["param_changes"] == 1

    restored = sm2.get_history()
    assert len(restored) == 3
    assert [e["event_type"] for e in restored] == [
        "diff_accepted",
        "diff_rejected",
        "param_changed",
    ]
    sm2.shutdown()

    print("OK — SessionMemory persistence verified")
    print(f"  tmp home: {_TMP}")
    print(f"  events:   {len(restored)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
