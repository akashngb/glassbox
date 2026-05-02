"""SessionMemory — per-project audit history with Backboard.io sync.

Local jsonl is the source of truth (writes are synchronous and fail-safe).
Backboard is a best-effort, write-behind sync target running on a background
worker. If Backboard is unreachable or the SDK is not installed, the app
keeps working unchanged and any local-only events are flushed on the next
successful connect.

Storage layout under ~/.glassbox (overridable via GLASSBOX_HOME):

    threads.json                  index keyed by absolute project path
    sessions/<local_id>.jsonl     append-only event log per project

Each event in the jsonl is a single JSON object:

    {"event_type": "...", "payload": {...}, "timestamp": <epoch_seconds>}
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Optional

try:
    from backboard import BackboardClient  # type: ignore
    _SDK_AVAILABLE = True
except ImportError:
    BackboardClient = None  # type: ignore
    _SDK_AVAILABLE = False


def _glassbox_home() -> Path:
    override = os.environ.get("GLASSBOX_HOME")
    return Path(override) if override else (Path.home() / ".glassbox")


class SessionMemory:
    def __init__(self, project_path: str) -> None:
        self.project_path = os.path.abspath(project_path)
        self.local_session_id = hashlib.sha256(
            self.project_path.encode("utf-8")
        ).hexdigest()[:16]

        home = _glassbox_home()
        self._threads_index = home / "threads.json"
        self._sessions_dir = home / "sessions"
        self._jsonl_path = self._sessions_dir / f"{self.local_session_id}.jsonl"
        home.mkdir(parents=True, exist_ok=True)
        self._sessions_dir.mkdir(parents=True, exist_ok=True)

        self.assistant_id: Optional[str] = None
        self.thread_id: Optional[str] = None
        self._client: Optional[Any] = None
        self._executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="glassbox-bb-sync"
        )
        self._file_lock = threading.Lock()
        self._index_lock = threading.Lock()
        self._prior_summary: dict = self._empty_summary()

    # ---------- public API ----------

    def resume_or_create(self) -> None:
        """Look up or create the Backboard binding for this project_path.

        Always succeeds — Backboard failures degrade silently to local-only.
        """
        entry = self._read_index().get(self.project_path, {})
        self.assistant_id = entry.get("assistant_id")
        self.thread_id = entry.get("thread_id")

        self._prior_summary = self._summarize_local()

        api_key = os.environ.get("BACKBOARD_API_KEY")
        if api_key and _SDK_AVAILABLE:
            try:
                self._client = BackboardClient(api_key=api_key)
            except Exception:
                self._client = None

        if self._client is None:
            return

        if not self.assistant_id:
            self._executor.submit(self._create_remote)
        else:
            self._executor.submit(self._sync_pending)

    def log_event(self, event_type: str, payload: dict) -> None:
        event = {
            "event_type": event_type,
            "payload": payload,
            "timestamp": time.time(),
        }
        self._append_local(event)
        if self._client is not None:
            self._executor.submit(self._sync_pending)

    def get_history(
        self,
        event_types: Optional[list[str]] = None,
        limit: int = 50,
    ) -> list[dict]:
        events = self._read_local_all()
        if event_types:
            events = [e for e in events if e.get("event_type") in event_types]
        if limit and len(events) > limit:
            events = events[-limit:]
        return events

    def get_accepted_diffs(self) -> list[dict]:
        return self.get_history(event_types=["diff_accepted"], limit=0)

    def get_rejected_diffs(self) -> list[dict]:
        return self.get_history(event_types=["diff_rejected"], limit=0)

    def get_param_history(self) -> list[dict]:
        return self.get_history(event_types=["param_changed"], limit=0)

    @property
    def resumed(self) -> bool:
        return self._prior_summary["total"] > 0

    @property
    def prior_summary(self) -> dict:
        return dict(self._prior_summary)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False)

    # ---------- index file ----------

    def _read_index(self) -> dict:
        if not self._threads_index.exists():
            return {}
        try:
            with self._index_lock:
                return json.loads(self._threads_index.read_text())
        except (OSError, json.JSONDecodeError):
            return {}

    def _update_index(self, **fields: Any) -> None:
        with self._index_lock:
            mapping: dict = {}
            if self._threads_index.exists():
                try:
                    mapping = json.loads(self._threads_index.read_text())
                except (OSError, json.JSONDecodeError):
                    mapping = {}
            entry = mapping.setdefault(self.project_path, {})
            entry["local_session_id"] = self.local_session_id
            entry.update(fields)
            tmp = self._threads_index.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(mapping, indent=2))
            os.replace(tmp, self._threads_index)

    # ---------- local jsonl ----------

    def _append_local(self, event: dict) -> None:
        line = json.dumps(event) + "\n"
        with self._file_lock:
            with open(self._jsonl_path, "a", encoding="utf-8") as fh:
                fh.write(line)

    def _read_local_all(self) -> list[dict]:
        if not self._jsonl_path.exists():
            return []
        events: list[dict] = []
        with self._file_lock:
            with open(self._jsonl_path, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return events

    @staticmethod
    def _empty_summary() -> dict:
        return {
            "total": 0,
            "accepted": 0,
            "rejected": 0,
            "param_changes": 0,
            "last_session_started": None,
        }

    def _summarize_local(self) -> dict:
        events = self._read_local_all()
        summary = self._empty_summary()
        summary["total"] = len(events)
        for e in events:
            t = e.get("event_type")
            if t == "diff_accepted":
                summary["accepted"] += 1
            elif t == "diff_rejected":
                summary["rejected"] += 1
            elif t == "param_changed":
                summary["param_changes"] += 1
        for e in reversed(events):
            if e.get("event_type") == "session_started":
                summary["last_session_started"] = e.get("timestamp")
                break
        return summary

    # ---------- Backboard sync (background only) ----------

    @staticmethod
    def _run_async(coro: Any) -> Any:
        # Each background submission runs in its own short-lived loop.
        # Simple, avoids cross-thread loop coordination.
        return asyncio.run(coro)

    def _create_remote(self) -> None:
        if self._client is None:
            return
        try:
            project_name = os.path.basename(self.project_path) or self.local_session_id
            assistant_name = f"glassbox::{project_name}::{self.local_session_id}"
            assistant = self._run_async(
                self._client.create_assistant(
                    name=assistant_name,
                    system_prompt=(
                        "Glassbox audit session. Memory entries are chronological "
                        "audit events for one project."
                    ),
                )
            )
            assistant_id = (
                getattr(assistant, "assistant_id", None)
                or getattr(assistant, "id", None)
            )
            if not assistant_id:
                return
            self.assistant_id = assistant_id
            self._update_index(assistant_id=assistant_id, synced_count=0)
            self._sync_pending()
        except Exception:
            return

    def _sync_pending(self) -> None:
        if self._client is None or not self.assistant_id:
            return
        try:
            entry = self._read_index().get(self.project_path, {})
            synced_count = int(entry.get("synced_count", 0))
            events = self._read_local_all()
            pending = events[synced_count:]
            for event in pending:
                payload_str = json.dumps(event.get("payload", {}))
                self._run_async(
                    self._client.add_memory(
                        self.assistant_id,
                        content=f"[{event['event_type']}] {payload_str}",
                        metadata={
                            "event_type": event.get("event_type"),
                            "timestamp": event.get("timestamp"),
                        },
                    )
                )
                synced_count += 1
                self._update_index(synced_count=synced_count)
        except Exception:
            return
