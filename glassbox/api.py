"""GlassboxAPI — exposed to JS via `window.pywebview.api`.

Phase 1: methods return baked fixtures from glassbox/fixtures/*.json.
Phase 3: `apply_splice` and `audit` shell out to sisa.py for real numbers.

Splice ADT (matches frontend/src/types/splice.ts):

    Splice =
      | { kind: "unlearn",   confidence: float, max_pct: float }
      | { kind: "reweight",  attribute: str }
      | { kind: "smote",     attribute: str }
      | { kind: "threshold", attribute: str, target_rate: float }
      | { kind: "fairlearn", attribute: str, constraint: str }

Each splice resolves to a deterministic fixture id during phase 1.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from glassbox import adapter

if TYPE_CHECKING:
    from glassbox.memory import SessionMemory

_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_BIAS_REPORT_PATH = _PROJECT_ROOT / "bias_report.json"
_RETUNE_PATH      = _PROJECT_ROOT / "retune.json"
_FIX_MESSAGE_PATH = _PROJECT_ROOT / "fix_message.md"
_ACCEPTED_JSON    = _PROJECT_ROOT / "glassbox_accepted.json"
_ACCEPTED_PY      = _PROJECT_ROOT / "glassbox_accepted.py"


class GlassboxAPI:
    """JS-callable surface. Every public method becomes window.pywebview.api.<name>."""

    def __init__(
        self,
        model_path: str | None = None,
        session: "SessionMemory | None" = None,
    ) -> None:
        self.model_path = model_path
        self._window = None
        self._fixtures = self._load_fixtures()
        self._session = session
        self._head_cache: dict[str, dict] = {}

    def bind_window(self, window: Any) -> None:
        self._window = window

    def _load_fixtures(self) -> dict[str, dict]:
        if not _FIXTURES_DIR.exists():
            return {}
        bundle = {}
        for f in _FIXTURES_DIR.glob("*.json"):
            with open(f) as fh:
                bundle[f.stem] = json.load(fh)
        return bundle

    def _live_baseline(self) -> dict | None:
        report = self._read_bias_report()
        if report is None:
            return None
        return adapter.baseline_analysis(report)

    def _read_bias_report(self) -> dict | None:
        if not _BIAS_REPORT_PATH.exists():
            return None
        try:
            with open(_BIAS_REPORT_PATH) as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError):
            return None

    def baseline(self) -> dict:
        """Return the baseline analysis (no splices applied). Demo entry point.

        Live audit (bias_report.json) wins; fixtures only when no audit is loadable.
        """
        live = self._live_baseline()
        if live is not None:
            return live
        return self._fixtures.get("baseline", _empty_analysis())

    def apply_splice(self, head_id: str, splice: dict) -> dict:
        """Return the analysis that results from applying `splice` to the state with `head_id`.

        Live mode: derive the post-splice analysis from the adapter using the
        primitive's published clinical effect on each panel. Same (head_id,
        splice_id) tuple always returns the same numbers.

        Fixture mode: look up the pre-baked fixture by composite key.
        """
        report = self._read_bias_report()
        if report is not None:
            if head_id in self._head_cache:
                base = self._head_cache[head_id]
            else:
                base = adapter.baseline_analysis(report)
                self._head_cache.setdefault("baseline", base)
            result = adapter.splice_analysis(report, base, head_id, splice)
            self._head_cache[result["id"]] = result
            return result
        fixture_id = _fixture_id(head_id, splice)
        if fixture_id in self._fixtures:
            return self._fixtures[fixture_id]
        return self._fixtures.get("baseline", _empty_analysis())

    def list_splices(self) -> list[dict]:
        """Return the splice catalog the SpliceTray renders. Phase 1: hardcoded."""
        return [
            {"id": "unlearn-male-high-conf", "kind": "unlearn", "label": "Unlearn high-confidence male positives",
             "primitive": "unlearn", "magnitude": 0.7,
             "args": {"confidence": 0.75, "max_pct": 0.05, "attribute": "sex"}},
            {"id": "reweight-sex", "kind": "reweight", "label": "Rebalance sample weights by sex",
             "primitive": "reweight", "magnitude": 0.5,
             "args": {"attribute": "sex"}},
            {"id": "smote-sex", "kind": "smote", "label": "SMOTE oversample minority sex",
             "primitive": "smote", "magnitude": 0.6,
             "args": {"attribute": "sex"}},
            {"id": "threshold-sex", "kind": "threshold", "label": "Per-group decision threshold (sex)",
             "primitive": "threshold", "magnitude": 0.3,
             "args": {"attribute": "sex", "target_rate": 0.30}},
            {"id": "fairlearn-sex-dp", "kind": "fairlearn", "label": "Fairlearn DemographicParity (sex)",
             "primitive": "fairlearn", "magnitude": 0.8,
             "args": {"attribute": "sex", "constraint": "DemographicParity"}},
            {"id": "unlearn-white-high-conf", "kind": "unlearn", "label": "Unlearn high-confidence white positives",
             "primitive": "unlearn", "magnitude": 0.7,
             "args": {"confidence": 0.75, "max_pct": 0.05, "attribute": "race"}},
            {"id": "reweight-race", "kind": "reweight", "label": "Rebalance sample weights by race",
             "primitive": "reweight", "magnitude": 0.5,
             "args": {"attribute": "race"}},
            {"id": "smote-race", "kind": "smote", "label": "SMOTE oversample minority race",
             "primitive": "smote", "magnitude": 0.6,
             "args": {"attribute": "race"}},
        ]

    def caption_for(self, splice_id: str, framing: str) -> str:
        """Look up a pre-written consequence caption. framing = accept | reject | committed."""
        captions = self._fixtures.get("captions", {})
        return captions.get(splice_id, {}).get(framing, "")

    def echo(self, msg: str) -> str:
        """Bridge sanity check: returns 'pong: <msg>'. Frontend calls this on boot."""
        return f"pong: {msg}"

    def bias_report(self) -> dict | None:
        """Return the bias_report.json produced by sisa.py at the project root.

        Returns None when the audit hasn't been run (file missing). Frontend
        treats None as "demo mode, fixtures only" and keeps the existing chrome.
        """
        return self._read_bias_report()

    def retune(self) -> dict | None:
        """Return retune.json produced by retune.py: predicted hyperparam tweaks."""
        if not _RETUNE_PATH.exists():
            return None
        with open(_RETUNE_PATH) as fh:
            return json.load(fh)

    def fix_message(self) -> str | None:
        """Return the Gemini-generated fix_message.md as raw markdown text."""
        if not _FIX_MESSAGE_PATH.exists():
            return None
        return _FIX_MESSAGE_PATH.read_text(encoding="utf-8")

    def model_identity(self) -> dict:
        """One-shot identity payload: dataset name, accuracy, flag count.

        Cheap to call on boot; keeps the Inspector empty state honest about
        whether real audit numbers are loaded or fixtures are in use.
        """
        report = self.bias_report()
        if report is None:
            return {"loaded": False}
        return adapter.project_identity(report)

    # ---- session memory bridge ----

    def session_info(self) -> dict:
        if self._session is None:
            return {"available": False, "resumed": False, "summary": None, "project_path": None}
        return {
            "available": True,
            "resumed": self._session.resumed,
            "summary": self._session.prior_summary,
            "project_path": self._session.project_path,
        }

    def session_history(self, event_types: list[str] | None = None, limit: int = 200) -> list[dict]:
        if self._session is None:
            return []
        return self._session.get_history(event_types=event_types, limit=limit)

    def accept_splice(self, splice_id: str, summary: str = "", file_paths: list[str] | None = None) -> dict:
        """Persist the accepted splice to disk. Returns {written, accepted_count, py_path}.

        Two artifacts at the project root:
          * glassbox_accepted.json — structured list of accepted splices
          * glassbox_accepted.py   — importable module exposing transform(X, y)
        """
        catalog = {s["id"]: s for s in self.list_splices()}
        splice = catalog.get(splice_id)
        if splice is None:
            return {"written": False, "reason": f"unknown splice {splice_id}"}

        accepted = self._read_accepted()
        from datetime import datetime, timezone
        accepted.append({
            "id": splice_id,
            "kind": splice.get("kind"),
            "label": splice.get("label"),
            "args": splice.get("args", {}),
            "magnitude": splice.get("magnitude"),
            "accepted_at": datetime.now(timezone.utc).isoformat(),
            "summary": summary,
        })
        _ACCEPTED_JSON.write_text(json.dumps(accepted, indent=2), encoding="utf-8")
        _ACCEPTED_PY.write_text(_render_accepted_module(accepted), encoding="utf-8")

        if self._session is not None:
            self._session.log_event(
                "diff_accepted",
                {
                    "diff_id": splice_id,
                    "summary": summary,
                    "file_paths": [str(_ACCEPTED_PY), str(_ACCEPTED_JSON)],
                },
            )
        return {
            "written": True,
            "accepted_count": len(accepted),
            "py_path": str(_ACCEPTED_PY.relative_to(_PROJECT_ROOT)),
            "json_path": str(_ACCEPTED_JSON.relative_to(_PROJECT_ROOT)),
        }

    def accepted_splices(self) -> list[dict]:
        """Return the current accepted-splice ledger. Empty list if none."""
        return self._read_accepted()

    def _read_accepted(self) -> list[dict]:
        if not _ACCEPTED_JSON.exists():
            return []
        try:
            with open(_ACCEPTED_JSON) as fh:
                data = json.load(fh)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def reset_accepted(self) -> bool:
        """Clear the accepted-splice ledger and reset the head cache. Used between demo runs."""
        for p in (_ACCEPTED_JSON, _ACCEPTED_PY):
            if p.exists():
                p.unlink()
        self._head_cache.clear()
        return True

    def reject_splice(self, splice_id: str, summary: str = "", reason: str = "") -> bool:
        if self._session is None:
            return False
        self._session.log_event(
            "diff_rejected",
            {"diff_id": splice_id, "summary": summary, "reason": reason},
        )
        return True

    def change_param(
        self,
        node_id: str,
        param_name: str,
        old_value: Any,
        new_value: Any,
    ) -> bool:
        if self._session is None:
            return False
        self._session.log_event(
            "param_changed",
            {
                "node_id": node_id,
                "param_name": param_name,
                "old_value": old_value,
                "new_value": new_value,
            },
        )
        return True


def _fixture_id(head_id: str, splice: dict) -> str:
    kind = splice.get("kind", "unknown")
    disambiguator = splice.get("id") or splice.get("attribute") or kind
    return f"{head_id}__{kind}_{disambiguator}"


_PRIMITIVE_RENDERERS: dict[str, str] = {
    "unlearn": (
        "def _splice_{idx}(X, y, sample_weight=None):\n"
        '    """{label}"""\n'
        "    mask = (X[{attribute!r}] == {privileged_value!r}) & (y == 1)\n"
        "    keep_n = int(len(X) - min(int(len(X) * {max_pct}), int(mask.sum())))\n"
        "    keep_idx = X.index[~mask].tolist() + X.index[mask].tolist()[: max(0, keep_n - (~mask).sum())]\n"
        "    keep_idx = sorted(set(keep_idx))\n"
        "    return X.loc[keep_idx], y.loc[keep_idx], (sample_weight.loc[keep_idx] if sample_weight is not None else None)\n"
    ),
    "reweight": (
        "def _splice_{idx}(X, y, sample_weight=None):\n"
        '    """{label}"""\n'
        "    counts = X[{attribute!r}].value_counts()\n"
        "    weights = 1.0 / X[{attribute!r}].map(counts)\n"
        "    weights = weights * (len(X) / weights.sum())\n"
        "    if sample_weight is not None:\n"
        "        weights = weights * sample_weight\n"
        "    return X, y, weights\n"
    ),
    "smote": (
        "def _splice_{idx}(X, y, sample_weight=None):\n"
        '    """{label}"""\n'
        "    from imblearn.over_sampling import SMOTENC\n"
        "    cat_cols = [i for i, c in enumerate(X.columns) if X[c].dtype == 'object' or c == {attribute!r}]\n"
        "    smote = SMOTENC(categorical_features=cat_cols, random_state=42)\n"
        "    Xr, yr = smote.fit_resample(X, y)\n"
        "    return Xr, yr, None\n"
    ),
    "threshold": (
        "def _splice_{idx}(X, y, sample_weight=None):\n"
        '    """{label}"""\n'
        "    X = X.copy()\n"
        "    X.attrs['glassbox_threshold'] = {{'attribute': {attribute!r}, 'target_rate': {target_rate}}}\n"
        "    return X, y, sample_weight\n"
    ),
    "fairlearn": (
        "def _splice_{idx}(X, y, sample_weight=None):\n"
        '    """{label}"""\n'
        "    X = X.copy()\n"
        "    X.attrs['glassbox_fairlearn'] = {{'attribute': {attribute!r}, 'constraint': {constraint!r}}}\n"
        "    return X, y, sample_weight\n"
    ),
}


def _render_accepted_module(accepted: list[dict]) -> str:
    """Emit a self-contained Python module containing transform() composing all accepted splices.

    The output is importable and runnable: `from glassbox_accepted import transform`
    then `X, y, w = transform(X, y)` before fitting.
    """
    header = (
        '"""Generated by Glassbox. Apply accepted splices before training.\n\n'
        "Composition order matches accept order. Re-running Glassbox and accepting more\n"
        "splices appends to this file (full rewrite, deterministic from glassbox_accepted.json).\n"
        '"""\n'
        "from __future__ import annotations\n\n"
    )
    if not accepted:
        return header + "def transform(X, y, sample_weight=None):\n    return X, y, sample_weight\n"

    body_parts: list[str] = []
    for idx, entry in enumerate(accepted):
        kind = entry.get("kind") or "unlearn"
        args = entry.get("args", {}) or {}
        template = _PRIMITIVE_RENDERERS.get(kind, _PRIMITIVE_RENDERERS["reweight"])
        ctx = {
            "idx":              idx,
            "label":            entry.get("label", entry.get("id", "")),
            "attribute":        args.get("attribute", "sex"),
            "max_pct":          args.get("max_pct", 0.05),
            "privileged_value": args.get("privileged_value", "Male"),
            "target_rate":      args.get("target_rate", 0.30),
            "constraint":       args.get("constraint", "DemographicParity"),
        }
        body_parts.append(template.format(**ctx))

    composer = ["def transform(X, y, sample_weight=None):"]
    composer.append('    """Apply each accepted splice in order. Returns (X, y, sample_weight)."""')
    for idx, _ in enumerate(accepted):
        composer.append(f"    X, y, sample_weight = _splice_{idx}(X, y, sample_weight)")
    composer.append("    return X, y, sample_weight\n")
    return header + "\n".join(body_parts) + "\n\n" + "\n".join(composer)


def _empty_analysis() -> dict:
    return {
        "id": "empty",
        "panels": {
            "dpd":      {"value": 0.0, "history": []},
            "dir":      {"value": 1.0, "history": []},
            "eod":      {"value": 0.0, "history": []},
            "accuracy": {"privileged": 0.0, "unprivileged": 0.0, "history": []},
            "flags":    [],
        },
        "caption": "",
    }
