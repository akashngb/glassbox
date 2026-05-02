"""Glassbox — a native window that visualizes machine unlearning."""
from glassbox.window import open_window

__version__ = "0.1.0"
__all__ = ["open", "open_window"]


def open(model_path: str | None = None, dev: bool = False) -> None:
    """Boot the Glassbox native window.

    Phase 1: model_path is accepted but the demo runs on baked fixtures.
    """
    open_window(model_path=model_path, dev=dev)
