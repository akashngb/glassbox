"""Glassbox — a native window that visualizes machine unlearning."""
from __future__ import annotations

import os
import sys
from typing import Any, Optional

from glassbox.memory import SessionMemory

__version__ = "0.1.0"
__all__ = ["open", "open_window", "get_session_memory"]

_session_memory: Optional[SessionMemory] = None
_window_started: bool = False


def get_session_memory() -> Optional[SessionMemory]:
    """Singleton accessor used by GlassboxAPI to log audit events."""
    return _session_memory


def open(model_path: str | None = None, dev: bool = False) -> None:
    """Boot the Glassbox native window.

    Phase 1: model_path is accepted but the demo runs on baked fixtures.
    Idempotent — repeat calls within a single process are no-ops.
    """
    global _session_memory, _window_started
    if _window_started:
        return
    _window_started = True

    from glassbox.window import open_window

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


def _should_autostart() -> bool:
    if os.environ.get("GLASSBOX_NO_AUTOSTART"):
        return False
    if "PYTEST_CURRENT_TEST" in os.environ or "pytest" in sys.modules:
        return False
    return True


if _should_autostart():
    open(dev=bool(os.environ.get("GLASSBOX_DEV")))
