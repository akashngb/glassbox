"""Glassbox — a native window that visualizes machine unlearning."""
from __future__ import annotations

import os
from typing import Any, Optional

from glassbox.memory import SessionMemory

__version__ = "0.1.0"
__all__ = ["open", "open_window", "get_session_memory"]

_session_memory: Optional[SessionMemory] = None


def get_session_memory() -> Optional[SessionMemory]:
    """Singleton accessor used by GlassboxAPI to log audit events."""
    return _session_memory


def open(model_path: str | None = None, dev: bool = False) -> None:
    """Boot the Glassbox native window.

    Phase 1: model_path is accepted but the demo runs on baked fixtures.
    """
    from glassbox.window import open_window

    global _session_memory
    project_path = os.path.abspath(model_path) if model_path else os.getcwd()
    _session_memory = SessionMemory(project_path)
    _session_memory.resume_or_create()
    _session_memory.log_event(
        "session_started",
        {"project_path": project_path, "baseline_metrics": None},
    )
    open_window(model_path=model_path, dev=dev, session=_session_memory)


def __getattr__(name: str) -> Any:
    if name == "open_window":
        from glassbox.window import open_window

        return open_window
    raise AttributeError(f"module 'glassbox' has no attribute {name!r}")
