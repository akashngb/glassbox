"""Pywebview window boot — embeds the React frontend, exposes Glassbox API."""
from __future__ import annotations

import os
from pathlib import Path

import webview

from glassbox.api import GlassboxAPI

_WINDOW_TITLE = "Glassbox"
_WINDOW_SIZE = (1280, 820)
_MIN_SIZE = (1024, 700)


def _resolve_frontend_url(dev: bool) -> str:
    """Return the URL or file path the webview loads.

    dev=True  -> Vite dev server at http://localhost:5173 (live reload).
    dev=False -> packaged frontend bundle at glassbox/frontend/index.html.
    """
    if dev:
        return os.environ.get("GLASSBOX_DEV_URL", "http://localhost:5173")

    bundle = Path(__file__).resolve().parent / "frontend" / "index.html"
    if not bundle.exists():
        raise FileNotFoundError(
            f"Frontend bundle not found at {bundle}. "
            "Run `cd frontend && npm run build` first, or pass --dev."
        )
    return str(bundle)


def open_window(model_path: str | None = None, dev: bool = False) -> None:
    api = GlassboxAPI(model_path=model_path)
    url = _resolve_frontend_url(dev)

    window = webview.create_window(
        title=_WINDOW_TITLE,
        url=url,
        js_api=api,
        width=_WINDOW_SIZE[0],
        height=_WINDOW_SIZE[1],
        min_size=_MIN_SIZE,
        background_color="#0e1014",
        text_select=False,
    )
    api.bind_window(window)

    webview.start(debug=dev)
