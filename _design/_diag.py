"""Diagnostic launcher: opens pywebview, queries DOM after 4s, prints findings, exits.

Run from project root:
    .venv/bin/python _design/_diag.py
"""
from __future__ import annotations

import os
import sys
import threading
import time

import webview

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from glassbox.api import GlassboxAPI


PROBE_JS = r"""
(function() {
  const out = {};
  out.url = location.href;
  out.title = document.title;
  out.bodyClass = document.body.className;
  out.rootChildren = document.getElementById('root')?.children?.length ?? 0;
  out.errors = (window.__glassboxErrors || []).slice(0, 5);
  out.bodyHTMLSize = document.body.innerHTML.length;
  out.computedBg = getComputedStyle(document.body).backgroundColor;
  out.tokens = {
    durBoot: getComputedStyle(document.documentElement).getPropertyValue('--dur-boot'),
    fontSans: getComputedStyle(document.documentElement).getPropertyValue('--font-sans'),
  };
  out.api = window.pywebview?.api ? Object.keys(window.pywebview.api) : 'NO API';
  out.bento = !!document.querySelector('.gb-bento-canvas');
  out.tray  = !!document.querySelector('.gb-tray-host');
  out.field = !!document.querySelector('.gb-probe-field');
  out.opacityChrome = (() => {
    const e = document.querySelector('.gb-cmd-host');
    return e ? getComputedStyle(e).opacity : 'no-cmd-host';
  })();
  return JSON.stringify(out, null, 2);
})()
"""


def probe(window):
    time.sleep(4)
    try:
        result = window.evaluate_js(PROBE_JS)
        print("\n========== DIAG RESULT ==========\n")
        print(result)
        print("\n=================================\n")
    except Exception as e:
        print(f"diag failed: {e}")
    finally:
        window.destroy()


def main():
    api = GlassboxAPI()
    win = webview.create_window(
        title="Glassbox Diag",
        url=os.environ.get("GLASSBOX_DEV_URL", "http://localhost:5173"),
        js_api=api,
        width=1280,
        height=820,
        background_color="#0e1014",
    )
    api.bind_window(win)

    t = threading.Thread(target=probe, args=(win,), daemon=True)
    t.start()
    webview.start(debug=True)


if __name__ == "__main__":
    main()
