"""
retune.py — reads bias_report.json produced by sisa.py and predicts
parameter values that should reduce the measured bias.

Each fairness violation's gap from its threshold drives a proportional
adjustment to the sisa.py parameters that most directly control it:

  Disparate impact / demographic parity  -> CANDIDATE_SCORE, MAX_UNLEARN_PCT
  Across-the-board severity              -> C (L2 regularization strength)
  Any violation present                  -> class_weight='balanced', more shards

Writes retune.json and prints a ready-to-paste config block.
"""
import json
import textwrap

REPORT_PATH = "bias_report.json"
OUTPUT_PATH = "retune.json"

# -- sisa.py defaults (baseline for delta computation) --------------------------
CURRENT_CANDIDATE_SCORE = 0.75
CURRENT_MAX_UNLEARN_PCT = 0.05
CURRENT_C               = 1.0
CURRENT_S               = 5
CURRENT_R               = 5

SEVERITY_WEIGHT = {"HIGH": 2.0, "MEDIUM": 1.0, "LOW": 0.5}


def load_report(path: str) -> dict:
    with open(path) as fh:
        return json.load(fh)


def analyse_flags(flags: list[dict]) -> dict:
    """Summarize violation severity and numeric gaps from bias_report flags."""
    a = {
        "n_high":        0,
        "n_medium":      0,
        "max_dpd_gap":   0.0,   # how far DPD exceeds its threshold
        "max_dir_gap":   0.0,   # how far DIR falls below its threshold
        "max_eod_gap":   0.0,
        "total_weight":  0.0,
    }
    for f in flags:
        w = SEVERITY_WEIGHT.get(f["severity"], 1.0)
        a["total_weight"] += w
        if f["severity"] == "HIGH":
            a["n_high"] += 1
        elif f["severity"] == "MEDIUM":
            a["n_medium"] += 1

        m, v, t = f["metric"], f["value"], f["threshold"]
        if m == "demographic_parity_diff":
            a["max_dpd_gap"] = max(a["max_dpd_gap"], v - t)
        elif m == "disparate_impact_ratio":
            a["max_dir_gap"] = max(a["max_dir_gap"], t - v)
        elif m == "equal_opportunity_diff":
            a["max_eod_gap"] = max(a["max_eod_gap"], v - t)
    return a


def predict_candidate_score(a: dict) -> float:
    """
    Lower the confidence threshold to flag more privileged-group samples for
    unlearning.  Both DPD and DIR violations mean P(ŷ=1|priv) is too high, so
    the pull is the worse of the two gaps, amplified by the number of HIGH flags.
    """
    dpd_pull = min(a["max_dpd_gap"] / 0.10, 1.0)
    dir_pull = min(a["max_dir_gap"] / 0.20, 1.0)
    pull     = max(dpd_pull, dir_pull) * (1.0 + 0.5 * a["n_high"])
    new      = CURRENT_CANDIDATE_SCORE - 0.15 * pull
    return round(max(0.50, min(CURRENT_CANDIDATE_SCORE, new)), 2)


def predict_max_unlearn_pct(a: dict, n_candidates: int, n_train: int) -> float:
    """
    Raise the unlearning cap when the candidate count already bumps against
    the current cap or when violation severity warrants removing more samples.
    Hard ceiling at 15% to preserve overall model utility.
    """
    pct_flagged    = n_candidates / max(n_train, 1)
    headroom       = max(0.0, pct_flagged - CURRENT_MAX_UNLEARN_PCT)
    severity_bonus = 0.025 * a["n_high"] + 0.01 * a["n_medium"]
    new            = CURRENT_MAX_UNLEARN_PCT + headroom + severity_bonus
    return round(min(0.15, max(CURRENT_MAX_UNLEARN_PCT, new)), 3)


def predict_C(a: dict) -> float:
    """
    Stronger L2 regularization (lower C) reduces the model's ability to exploit
    group-correlated features.  Scale the reduction with flag severity.
    """
    if a["n_high"] > 0:
        return 0.1
    if a["n_medium"] > 0:
        return 0.3
    return CURRENT_C


def predict_S(n_candidates: int) -> int:
    """
    More shards mean each shard is smaller, so an unlearn operation touches
    fewer slice checkpoints and is cheaper to retrain.
    """
    if n_candidates > 200:
        return 10
    if n_candidates > 50:
        return 8
    return CURRENT_S


def predict_class_weight(a: dict):
    return "balanced" if (a["n_high"] + a["n_medium"]) > 0 else None


def build_rationale(a: dict, params: dict) -> list[str]:
    lines = []
    if params["CANDIDATE_SCORE"] < CURRENT_CANDIDATE_SCORE:
        lines.append(
            f"CANDIDATE_SCORE {CURRENT_CANDIDATE_SCORE} -> {params['CANDIDATE_SCORE']}: "
            f"captures more high-confidence privileged-group predictions for unlearning "
            f"(DPD gap {a['max_dpd_gap']:+.3f}, DIR gap {a['max_dir_gap']:.3f})"
        )
    if params["MAX_UNLEARN_PCT"] > CURRENT_MAX_UNLEARN_PCT:
        lines.append(
            f"MAX_UNLEARN_PCT {CURRENT_MAX_UNLEARN_PCT} -> {params['MAX_UNLEARN_PCT']}: "
            f"allows unlearning of more training samples "
            f"({a['n_high']} HIGH flag(s), {a['n_medium']} MEDIUM flag(s))"
        )
    if params["C"] < CURRENT_C:
        lines.append(
            f"C {CURRENT_C} -> {params['C']}: "
            f"stronger L2 regularization reduces reliance on group-correlated features"
        )
    if params["class_weight"] == "balanced":
        lines.append(
            "class_weight None -> 'balanced': equalizes class influence during training, "
            "which tends to narrow positive-prediction-rate gaps across groups"
        )
    if params["S"] > CURRENT_S:
        lines.append(
            f"S {CURRENT_S} -> {params['S']}: "
            f"more SISA shards reduce the retraining cost of each future unlearn operation"
        )
    return lines


def print_summary(report: dict, params: dict, rationale: list[str], a: dict) -> None:
    W = 62
    print(f"\n{'='*W}")
    print("  RETUNE RECOMMENDATIONS")
    print(f"{'='*W}")
    print(f"\nSource  : {REPORT_PATH}")
    print(f"Flags   : {a['n_high']} HIGH  {a['n_medium']} MEDIUM")

    bl = report["baseline"]
    pu = report.get("post_unlearn", {})
    print(f"\nBaseline accuracy    : {bl['accuracy']:.4f}")
    if pu:
        delta = pu["accuracy"] - bl["accuracy"]
        print(f"Post-unlearn accuracy: {pu['accuracy']:.4f}  (delta = {delta:+.4f})")

    print(f"\n{'-'*W}")
    print("  Predicted adjustments")
    print(f"{'-'*W}")

    if rationale:
        for line in rationale:
            for part in textwrap.wrap(line, width=W - 2, subsequent_indent="    "):
                print(f"  {part}")
            print()
    else:
        print("  No changes recommended -- all metrics within thresholds.\n")

    print(f"{'-'*W}")
    print("  # paste into sisa.py")
    print(f"{'-'*W}")
    print(f"  CANDIDATE_SCORE = {params['CANDIDATE_SCORE']}")
    print(f"  MAX_UNLEARN_PCT = {params['MAX_UNLEARN_PCT']}")
    print(f"  C               = {params['C']}")
    cw = f'"{params["class_weight"]}"' if params["class_weight"] else "None"
    print(f"  class_weight    = {cw}")
    print(f"  S               = {params['S']}")
    print(f"  R               = {params['R']}")
    print(f"\nFull output -> {OUTPUT_PATH}")


if __name__ == "__main__":
    report       = load_report(REPORT_PATH)
    flags        = report.get("bias_flags", [])
    candidates   = report.get("unlearn_candidates", {})
    n_train      = report["dataset"]["n_train"]
    n_candidates = sum(len(v) for v in candidates.values())

    a = analyse_flags(flags)

    params = {
        "CANDIDATE_SCORE": predict_candidate_score(a),
        "MAX_UNLEARN_PCT":  predict_max_unlearn_pct(a, n_candidates, n_train),
        "C":                predict_C(a),
        "class_weight":     predict_class_weight(a),
        "S":                predict_S(n_candidates),
        "R":                CURRENT_R,
    }

    rationale = build_rationale(a, params)

    output = {
        "source_report":    REPORT_PATH,
        "n_flags":          {"HIGH": a["n_high"], "MEDIUM": a["n_medium"]},
        "predicted_params": params,
        "rationale":        rationale,
    }

    with open(OUTPUT_PATH, "w") as fh:
        json.dump(output, fh, indent=2)

    print_summary(report, params, rationale, a)
