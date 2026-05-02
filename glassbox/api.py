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

if TYPE_CHECKING:
    from glassbox.memory import SessionMemory

_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_BIAS_REPORT_PATH = _PROJECT_ROOT / "bias_report.json"
_RETUNE_PATH      = _PROJECT_ROOT / "retune.json"
_FIX_MESSAGE_PATH = _PROJECT_ROOT / "fix_message.md"


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

    def baseline(self) -> dict:
        """Return the baseline analysis (no splices applied). Demo entry point."""
        return self._fixtures.get("baseline", _empty_analysis())

    def apply_splice(self, head_id: str, splice: dict) -> dict:
        """Return the analysis that results from applying `splice` to the state with `head_id`.

        Phase 1 lookup: fixture key = f"{head_id}__{splice['kind']}_{splice_disambiguator(splice)}".
        Phase 3 will dispatch to the real sisa.py pipeline.
        """
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
        if not _BIAS_REPORT_PATH.exists():
            return None
        with open(_BIAS_REPORT_PATH) as fh:
            return json.load(fh)

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
        ds = report.get("dataset", {})
        return {
            "loaded": True,
            "dataset_path": ds.get("path"),
            "n_samples": ds.get("n_samples"),
            "accuracy": report.get("baseline", {}).get("accuracy"),
            "n_flags": len(report.get("bias_flags", [])),
            "protected_attributes": report.get("protected_attributes", []),
        }

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

    def accept_splice(self, splice_id: str, summary: str = "", file_paths: list[str] | None = None) -> bool:
        if self._session is None:
            return False
        self._session.log_event(
            "diff_accepted",
            {
                "diff_id": splice_id,
                "summary": summary,
                "file_paths": file_paths or [],
            },
        )
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
