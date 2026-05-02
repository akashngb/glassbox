"""Glassbox — a native window that visualizes machine unlearning."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from glassbox.memory import SessionMemory

__version__ = "0.1.0"
__all__ = ["open", "open_window", "get_session_memory"]

_session_memory: Optional[SessionMemory] = None


class GlassboxError(Exception):
    """User-facing boot error. __main__ catches this and prints the message."""


def get_session_memory() -> Optional[SessionMemory]:
    """Singleton accessor used by GlassboxAPI to log audit events."""
    return _session_memory


def open(model_path: str | None = None, dev: bool = False) -> None:
    """Boot the Glassbox native window.

    When model_path is supplied, the file must exist on disk. The window then
    opens against whichever bias_report.json sits at the project root (i.e. the
    most recent sisa.py run). If no bias_report.json is present, the frontend
    falls back to fixtures with a visible warning.
    """
    from glassbox.window import open_window

    if model_path is not None:
        resolved = Path(model_path).expanduser().resolve()
        if not resolved.exists():
            raise GlassboxError(f"Model file not found: {model_path}")
        if not resolved.is_file():
            raise GlassboxError(f"Model path is not a file: {model_path}")
        model_path = str(resolved)

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
