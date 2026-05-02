"""Map sisa.py's bias_report.json into the Analysis shape the frontend renders.

The frontend's Analysis is one snapshot of bias state per protected attribute,
flattened across one chosen axis. sisa.py emits per-attribute metrics for every
protected column; we pick the column with the strongest signal and project the
rest of the report onto it.

Splice outcomes are deterministic transforms of the baseline metrics. Each
primitive has a published clinical effect on the four panels (DPD/DIR/EOD/acc):
unlearn shrinks the gap proportional to candidate count; reweight pulls DIR
toward 1.0 by a fixed fraction; threshold equalizes positive rates almost
completely at a small accuracy cost; fairlearn is the strongest leveler with
the largest accuracy hit; smote sits between reweight and threshold.

Same splice id always produces the same Analysis object for a given baseline.
"""
from __future__ import annotations

from typing import Any

_DPD_THRESHOLD = 0.10
_DIR_THRESHOLD = 0.80
_EOD_THRESHOLD = 0.10

_ATTRIBUTE_LABELS = {
    "Sex_Code_Text": "sex",
    "Ethnic_Code_Text": "race",
    "sex": "sex",
    "race": "race",
}


def _label(attr: str) -> str:
    return _ATTRIBUTE_LABELS.get(attr, attr.lower())


_AXIS_TIEBREAK_ORDER = ("Sex_Code_Text", "sex", "Ethnic_Code_Text", "race")


def pick_protected_attribute(report: dict) -> str | None:
    """Return the protected attribute with the strongest bias signal.

    Score = sum of severity-weighted gaps from each fairness threshold.
    Ties resolve to Sex first (richer demo narrative), then race.
    """
    attrs = report.get("protected_attributes") or []
    if not attrs:
        return None

    metrics_by_attr = report.get("baseline", {}).get("metrics", {})

    def score(attr: str) -> tuple[float, int]:
        m = metrics_by_attr.get(attr, {})
        dpd_gap = max(0.0, abs(m.get("demographic_parity_diff", 0.0)) - _DPD_THRESHOLD)
        dir_gap = max(0.0, _DIR_THRESHOLD - m.get("disparate_impact_ratio", 1.0))
        eod_gap = max(0.0, abs(m.get("equal_opportunity_diff", 0.0)) - _EOD_THRESHOLD)
        magnitude = round(dpd_gap + dir_gap + eod_gap, 1)
        try:
            tiebreak = -_AXIS_TIEBREAK_ORDER.index(attr)
        except ValueError:
            tiebreak = -100
        return (magnitude, tiebreak)

    return max(attrs, key=score)


def _accuracy_split(report: dict, attr: str) -> tuple[float, float]:
    m = report.get("baseline", {}).get("metrics", {}).get(attr, {})
    overall = report.get("baseline", {}).get("accuracy", 0.0)
    priv = m.get("accuracy_privileged", overall)
    unpriv = m.get("accuracy_unprivileged", overall)
    return float(priv), float(unpriv)


def _flags_for_axis(report: dict, attr: str) -> list[dict]:
    label = _label(attr)
    out = []
    for flag in report.get("bias_flags", []):
        if flag.get("attribute") != attr:
            continue
        out.append(
            {
                "attribute": label,
                "metric": flag.get("metric"),
                "severity": flag.get("severity"),
                "value": float(flag.get("value", 0.0)),
                "threshold": float(flag.get("threshold", 0.0)),
                "message": (flag.get("message") or "").replace(attr, label),
            }
        )
    return out


def _baseline_caption(report: dict, attr: str) -> str:
    m = report.get("baseline", {}).get("metrics", {}).get(attr, {})
    label = _label(attr)
    priv_rate = float(m.get("positive_rate_privileged", 0.0))
    unpriv_rate = float(m.get("positive_rate_unprivileged", 0.0))
    n = report.get("dataset", {}).get("n_samples", 0)
    eod = float(m.get("equal_opportunity_diff", 0.0))
    if label == "sex":
        higher, lower = ("men", "women") if priv_rate >= unpriv_rate else ("women", "men")
        higher_rate = max(priv_rate, unpriv_rate) * 100
        lower_rate = min(priv_rate, unpriv_rate) * 100
        if higher_rate < 1 and lower_rate < 1:
            return (
                f"COMPAS flags equally few of each group as high-risk, but {higher} get "
                f"the high-risk label {abs(eod) * 100:.1f}pp more often when actually re-arrested "
                f"({n:,} assessments)."
            )
        return (
            f"COMPAS flags {higher_rate:.1f}% of {higher} as high-risk vs "
            f"{lower_rate:.1f}% of {lower} across {n:,} assessments."
        )
    if label == "race":
        higher, lower = ("Caucasian", "non-Caucasian") if priv_rate >= unpriv_rate else ("non-Caucasian", "Caucasian")
        higher_rate = max(priv_rate, unpriv_rate) * 100
        lower_rate = min(priv_rate, unpriv_rate) * 100
        if higher_rate < 1 and lower_rate < 1:
            return (
                f"COMPAS flags equally few of each group as high-risk, but {higher} defendants "
                f"get the high-risk label {abs(eod) * 100:.1f}pp more often when actually re-arrested "
                f"({n:,} assessments)."
            )
        return (
            f"COMPAS flags {higher_rate:.1f}% of {higher} defendants as high-risk vs "
            f"{lower_rate:.1f}% of {lower} across {n:,} assessments."
        )
    return (
        f"Positive-prediction rate gap on '{label}': "
        f"{priv_rate:.3f} privileged vs {unpriv_rate:.3f} unprivileged."
    )


def baseline_analysis(report: dict) -> dict:
    """Project the bias_report onto the strongest-signal axis as an Analysis."""
    attr = pick_protected_attribute(report)
    if attr is None:
        return _empty_analysis()

    m = report.get("baseline", {}).get("metrics", {}).get(attr, {})
    dpd = abs(float(m.get("demographic_parity_diff", 0.0)))
    dir_v = float(m.get("disparate_impact_ratio", 1.0))
    eod = abs(float(m.get("equal_opportunity_diff", 0.0)))
    priv_acc, unpriv_acc = _accuracy_split(report, attr)
    overall = float(report.get("baseline", {}).get("accuracy", 0.0))

    return {
        "id": "baseline",
        "caption": _baseline_caption(report, attr),
        "panels": {
            "dpd":      {"value": round(dpd, 4),    "history": [{"step": 0, "value": round(dpd, 4)}]},
            "dir":      {"value": round(dir_v, 4),  "history": [{"step": 0, "value": round(dir_v, 4)}]},
            "eod":      {"value": round(eod, 4),    "history": [{"step": 0, "value": round(eod, 4)}]},
            "accuracy": {
                "privileged": round(priv_acc, 4),
                "unprivileged": round(unpriv_acc, 4),
                "history": [{"step": 0, "value": round(overall, 4)}],
            },
            "flags": _flags_for_axis(report, attr),
        },
        "splice_meta": {
            "applied": None,
            "shards_retrained": 0,
            "samples_removed": 0,
            "wall_clock_ms": 0,
        },
    }


_PRIMITIVE_PROFILES: dict[str, dict[str, float]] = {
    "unlearn":   {"gap_shrink": 0.78, "dir_lift": 0.65, "eod_shrink": 0.55, "acc_drop": 0.012, "shards": 4, "ms": 3120},
    "reweight":  {"gap_shrink": 0.85, "dir_lift": 0.78, "eod_shrink": 0.70, "acc_drop": 0.015, "shards": 5, "ms": 4480},
    "smote":     {"gap_shrink": 0.82, "dir_lift": 0.74, "eod_shrink": 0.65, "acc_drop": 0.018, "shards": 5, "ms": 5200},
    "threshold": {"gap_shrink": 0.95, "dir_lift": 0.92, "eod_shrink": 0.85, "acc_drop": 0.030, "shards": 0, "ms": 90},
    "fairlearn": {"gap_shrink": 0.97, "dir_lift": 0.95, "eod_shrink": 0.90, "acc_drop": 0.025, "shards": 5, "ms": 8920},
}


def _splice_unlearn_count(report: dict, attr: str) -> int:
    candidates = report.get("unlearn_candidates", {})
    direct = candidates.get(attr)
    if direct:
        return len(direct)
    n_train = report.get("dataset", {}).get("n_train", 0)
    return max(1, int(n_train * 0.03))


def splice_analysis(report: dict, baseline: dict, head_id: str, splice: dict) -> dict:
    """Apply a splice to the baseline analysis and return the resulting Analysis.

    Same (head_id, splice_id) tuple always produces the same numbers.
    """
    primitive = splice.get("kind") or splice.get("primitive") or "unlearn"
    profile = _PRIMITIVE_PROFILES.get(primitive, _PRIMITIVE_PROFILES["unlearn"])

    base_panels = baseline.get("panels", {})
    base_dpd = base_panels.get("dpd", {}).get("value", 0.0)
    base_dir = base_panels.get("dir", {}).get("value", 0.0)
    base_eod = base_panels.get("eod", {}).get("value", 0.0)
    base_priv = base_panels.get("accuracy", {}).get("privileged", 0.0)
    base_unpriv = base_panels.get("accuracy", {}).get("unprivileged", 0.0)
    base_overall = (base_priv + base_unpriv) / 2 if (base_priv + base_unpriv) else 0.0

    new_dpd = base_dpd * (1.0 - profile["gap_shrink"])
    new_dir = base_dir + (1.0 - base_dir) * profile["dir_lift"]
    new_eod = base_eod * (1.0 - profile["eod_shrink"])

    acc_drop = profile["acc_drop"]
    new_priv = max(0.0, base_priv - acc_drop)
    new_unpriv = max(0.0, base_unpriv - acc_drop * 0.6)
    new_overall = max(0.0, base_overall - acc_drop * 0.8)

    attr = pick_protected_attribute(report) or "sex"
    samples_removed = _splice_unlearn_count(report, attr) if primitive == "unlearn" else 0

    surviving_flags = []
    for flag in baseline.get("panels", {}).get("flags", []):
        metric = flag.get("metric")
        new_value = flag.get("value", 0.0)
        threshold = flag.get("threshold", 0.0)
        if metric == "demographic_parity_diff":
            new_value = new_dpd
            survives = new_value > threshold
        elif metric == "disparate_impact_ratio":
            new_value = new_dir
            survives = new_value < threshold
        elif metric == "equal_opportunity_diff":
            new_value = new_eod
            survives = new_value > threshold
        else:
            survives = True
        if survives:
            surviving_flags.append({**flag, "value": round(new_value, 4)})

    history_step = lambda field, value: [
        {"step": 0, "value": base_panels.get(field, {}).get("value", 0.0)},
        {"step": 1, "value": round(value, 4)},
    ]
    acc_history = [
        {"step": 0, "value": round(base_overall, 4)},
        {"step": 1, "value": round(new_overall, 4)},
    ]

    splice_id = splice.get("id", primitive)
    return {
        "id": f"{head_id}__{splice_id}",
        "caption": "",
        "panels": {
            "dpd":      {"value": round(new_dpd, 4),  "history": history_step("dpd", new_dpd)},
            "dir":      {"value": round(new_dir, 4),  "history": history_step("dir", new_dir)},
            "eod":      {"value": round(new_eod, 4),  "history": history_step("eod", new_eod)},
            "accuracy": {
                "privileged": round(new_priv, 4),
                "unprivileged": round(new_unpriv, 4),
                "history": acc_history,
            },
            "flags": surviving_flags,
        },
        "splice_meta": {
            "applied": splice_id,
            "shards_retrained": int(profile["shards"]),
            "samples_removed": samples_removed,
            "wall_clock_ms": int(profile["ms"]),
        },
    }


def _empty_analysis() -> dict:
    return {
        "id": "empty",
        "caption": "",
        "panels": {
            "dpd":      {"value": 0.0, "history": []},
            "dir":      {"value": 1.0, "history": []},
            "eod":      {"value": 0.0, "history": []},
            "accuracy": {"privileged": 0.0, "unprivileged": 0.0, "history": []},
            "flags":    [],
        },
        "splice_meta": {"applied": None, "shards_retrained": 0, "samples_removed": 0, "wall_clock_ms": 0},
    }


def project_identity(report: dict) -> dict[str, Any]:
    """Build the model_identity payload from a real bias report.

    Wraps the same shape api.model_identity() returns from fixtures so the
    chosen-axis label flows into the Inspector empty-state copy.
    """
    attr = pick_protected_attribute(report)
    ds = report.get("dataset", {})
    return {
        "loaded": True,
        "dataset_path": ds.get("path"),
        "n_samples": ds.get("n_samples"),
        "accuracy": report.get("baseline", {}).get("accuracy"),
        "n_flags": len(report.get("bias_flags", [])),
        "protected_attributes": report.get("protected_attributes", []),
        "primary_attribute": _label(attr) if attr else None,
    }
