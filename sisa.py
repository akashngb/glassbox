"""
Bias-aware SISA pipeline — backend for the VS Code bias-visualizer extension.
Dataset: ProPublica COMPAS Recidivism (compas-scores-raw.csv)

Workflow
--------
1.  Load compas-scores-raw.csv; filter to completed Risk-of-Recidivism rows
2.  Derive age from DateOfBirth / Screening_Date
3.  Extract protected attributes (Sex_Code_Text, Ethnic_Code_Text) as binary
    columns BEFORE encoding so group membership is not scrambled
4.  Train a baseline LogisticRegression
5.  Compute fairness metrics per protected attribute on the test set
6.  Flag violations: demographic parity, disparate impact (80% rule), equal opportunity
7.  Identify training samples to unlearn — high-confidence positive predictions
    in the privileged group that are inflating the positive-prediction-rate gap
8.  Use SISA to retrain only the affected shards (efficient machine unlearning)
9.  Recompute metrics post-unlearn and measure improvement
10. Generate ranked code-fix recommendations with copy-paste snippets
11. Write bias_report.json for the VS Code extension to render
"""
import os
import json
import pickle
import textwrap
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from glassbox.bias import get_social_context

# ── Config ─────────────────────────────────────────────────────────────────────
DATASET_PATH    = "compas-scores-raw.csv"
S               = 5       # SISA shards
R               = 5       # SISA slices per shard
MODELS_DIR      = "models"
REPORT_PATH     = "bias_report.json"
RANDOM_STATE    = 42

# Fairness thresholds
DPD_THRESHOLD   = 0.10   # max acceptable demographic parity difference
DIR_THRESHOLD   = 0.80   # min acceptable disparate impact ratio (80% rule)
EOD_THRESHOLD   = 0.10   # max acceptable equal opportunity difference

# Unlearn candidate selection
CANDIDATE_SCORE = 0.75   # min model confidence to flag a sample as a candidate
MAX_UNLEARN_PCT = 0.05   # cap unlearning at 5% of training set per attribute

os.makedirs(MODELS_DIR, exist_ok=True)

# COMPAS-specific constants
SCALE_FILTER    = "Risk of Recidivism"   # keep one row per assessment
# Attribute name → string value that represents the privileged group
PROTECTED_ATTRS = {"Sex_Code_Text": "Male", "Ethnic_Code_Text": "Caucasian"}
TARGET_COL      = "ScoreText"
POSITIVE_LABEL  = "High"

# Columns to drop before feature encoding:
#   - identifiers and names
#   - raw date strings (age is derived from them)
#   - COMPAS score outputs (circular with the target)
#   - scale metadata used only for row selection
DROP_COLS = [
    "Person_ID", "AssessmentID", "Case_ID",
    "LastName", "FirstName", "MiddleName",
    "DateOfBirth", "Screening_Date",
    "ScaleSet_ID", "ScaleSet", "Scale_ID", "DisplayText",
    "RawScore", "DecileScore",
    "RecSupervisionLevel", "RecSupervisionLevelText",
    "AssessmentReason",
    "IsCompleted", "IsDeleted",
]


# ── Data loading ───────────────────────────────────────────────────────────────
def load_and_preprocess(path: str):
    """
    Returns
    -------
    X          : (n, d) float array, scaled
    y          : (n,) int array — 1 means ScoreText == "High"
    protected  : (n, p) int array — 1 = privileged group, 0 = unprivileged
    attr_names : list[str] — names of protected attributes found in the dataset
    """
    df = pd.read_csv(path)

    # One row per person per assessment: keep completed recidivism-risk rows only
    df = df[(df["IsCompleted"] == 1) & (df["IsDeleted"] == 0)]
    df = df[df["DisplayText"] == SCALE_FILTER].copy()
    df.reset_index(drop=True, inplace=True)

    # Derive age at screening from the two date columns
    dob            = pd.to_datetime(df["DateOfBirth"],   errors="coerce")
    screen         = pd.to_datetime(df["Screening_Date"], errors="coerce")
    df["age"]      = ((screen - dob).dt.days / 365.25).round(1)

    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    required = ["age", TARGET_COL] + [a for a in PROTECTED_ATTRS if a in df.columns]
    df.dropna(subset=required, inplace=True)
    df.reset_index(drop=True, inplace=True)

    # Extract protected attributes as binary BEFORE any encoding so group
    # membership is not scrambled by LabelEncoder.
    attr_names = [a for a in PROTECTED_ATTRS if a in df.columns]
    protected = np.column_stack([
        (df[attr] == PROTECTED_ATTRS[attr]).astype(int).values
        for attr in attr_names
    ]) if attr_names else np.empty((len(df), 0), dtype=int)

    y = (df[TARGET_COL] == POSITIVE_LABEL).astype(int).values

    feat_df = df.drop(columns=[TARGET_COL])
    for col in feat_df.select_dtypes(include="object").columns:
        feat_df[col] = LabelEncoder().fit_transform(feat_df[col].astype(str))
    X = StandardScaler().fit_transform(feat_df.values.astype(float))

    return X, y, protected, attr_names


# ── SISA ───────────────────────────────────────────────────────────────────────
class SISA:
    """
    Sharded, Isolated, Sliced, and Aggregated training.

    Role in this pipeline
    ---------------------
    SISA is the *efficient retraining backbone*.  When unlearn() is called with
    bias-contributing sample IDs, it retrains only the shard(s) that contain
    those samples and only from the earliest affected slice onward — all earlier
    slice checkpoints remain valid and are reused.

    Artefacts on disk
    -----------------
    models/shard_{i}_slice_{j}.pkl  — checkpoint after cumulative slices 0..j
    models/shard_{i}.pkl            — final constituent model for shard i
    """

    def __init__(self, X: np.ndarray, y: np.ndarray, s: int = S, r: int = R):
        self.s, self.r = s, r
        self.X, self.y = X, y
        rng = np.random.default_rng(RANDOM_STATE)
        idx = rng.permutation(len(X))
        self.shard_indices: list[np.ndarray] = list(np.array_split(idx, s))
        self.slice_indices: list[list[np.ndarray]] = [
            list(np.array_split(sh, r)) for sh in self.shard_indices
        ]
        self.models: list = [None] * s

    def _ckpt(self, i: int, j: int) -> str:
        return os.path.join(MODELS_DIR, f"shard_{i}_slice_{j}.pkl")

    def _path(self, i: int) -> str:
        return os.path.join(MODELS_DIR, f"shard_{i}.pkl")

    def _train_shard(self, i: int, from_slice: int = 0) -> LogisticRegression:
        slices = self.slice_indices[i]
        if from_slice == 0:
            model = LogisticRegression(max_iter=1000, warm_start=True, random_state=RANDOM_STATE)
        else:
            with open(self._ckpt(i, from_slice - 1), "rb") as fh:
                model = pickle.load(fh)
        for j in range(from_slice, self.r):
            idx = np.concatenate(slices[: j + 1])
            if len(idx) == 0:
                continue
            model.fit(self.X[idx], self.y[idx])
            with open(self._ckpt(i, j), "wb") as fh:
                pickle.dump(model, fh)
        with open(self._path(i), "wb") as fh:
            pickle.dump(model, fh)
        return model

    def train(self) -> None:
        print(f"\n{'='*60}")
        print(f"  SISA Training  |  S={self.s} shards,  R={self.r} slices")
        print(f"{'='*60}")
        for i, sh in enumerate(self.shard_indices):
            print(f"\nShard {i}: {len(sh)} samples")
            for j, sl in enumerate(self.slice_indices[i]):
                print(f"  Slice {j}: {len(sl)} samples")
            self.models[i] = self._train_shard(i)
            print(f"  -> {self._path(i)}")

    def predict(self, X: np.ndarray) -> np.ndarray:
        votes = np.stack([m.predict(X) for m in self.models], axis=1)
        return np.apply_along_axis(
            lambda row: Counter(row).most_common(1)[0][0], axis=1, arr=votes
        )

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return np.mean([m.predict_proba(X) for m in self.models], axis=0)

    def unlearn(self, sample_ids: list[int]) -> list[int]:
        to_forget = set(sample_ids)
        retrained: list[int] = []
        for i in range(self.s):
            affected = to_forget & set(self.shard_indices[i].tolist())
            if not affected:
                continue
            earliest = next(
                (j for j, sl in enumerate(self.slice_indices[i])
                 if affected & set(sl.tolist())), self.r
            )
            self.shard_indices[i] = self.shard_indices[i][
                ~np.isin(self.shard_indices[i], list(to_forget))
            ]
            self.slice_indices[i] = [
                sl[~np.isin(sl, list(to_forget))] for sl in self.slice_indices[i]
            ]
            print(f"  [Unlearn] Shard {i}: removing {len(affected)} samples, "
                  f"retrain from slice {earliest}")
            self.models[i] = self._train_shard(i, from_slice=earliest)
            retrained.append(i)
        return retrained


# ── Bias metrics ───────────────────────────────────────────────────────────────
def _tpr(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    pos = y_true == 1
    return float(y_pred[pos].mean()) if pos.any() else 0.0

def _fpr(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    neg = y_true == 0
    return float(y_pred[neg].mean()) if neg.any() else 0.0

def compute_bias_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    protected: np.ndarray,
    attr_names: list[str],
) -> dict:
    """
    Compute per-attribute fairness metrics.

    Metrics
    -------
    demographic_parity_diff  : P(ŷ=1|priv) − P(ŷ=1|unpriv)   — ideally 0
    disparate_impact_ratio   : P(ŷ=1|unpriv) / P(ŷ=1|priv)   — ideally ≥ 0.8
    equal_opportunity_diff   : TPR(priv) − TPR(unpriv)         — ideally 0
    equalized_odds           : max(|ΔTPR|, |ΔFPR|)             — ideally 0
    """
    metrics = {}
    for col, attr in enumerate(attr_names):
        priv   = protected[:, col] == 1
        unpriv = ~priv

        ppr_p = float(y_pred[priv].mean())
        ppr_u = float(y_pred[unpriv].mean())
        dpd   = ppr_p - ppr_u
        dir_r = (ppr_u / ppr_p) if ppr_p > 0 else 0.0

        tpr_p, tpr_u = _tpr(y_true[priv], y_pred[priv]), _tpr(y_true[unpriv], y_pred[unpriv])
        fpr_p, fpr_u = _fpr(y_true[priv], y_pred[priv]), _fpr(y_true[unpriv], y_pred[unpriv])

        metrics[attr] = {
            "positive_rate_privileged":   round(ppr_p,  4),
            "positive_rate_unprivileged": round(ppr_u,  4),
            "demographic_parity_diff":    round(dpd,    4),
            "disparate_impact_ratio":     round(dir_r,  4),
            "equal_opportunity_diff":     round(tpr_p - tpr_u, 4),
            "equalized_odds":             round(max(abs(tpr_p - tpr_u), abs(fpr_p - fpr_u)), 4),
            "accuracy_privileged":        round(float(accuracy_score(y_true[priv],   y_pred[priv])),   4),
            "accuracy_unprivileged":      round(float(accuracy_score(y_true[unpriv], y_pred[unpriv])), 4),
        }
    return metrics


def flag_bias(metrics_by_attr: dict) -> list[dict]:
    """Return sorted list of threshold violations for the VS Code extension to display."""
    flags = []
    for attr, m in metrics_by_attr.items():
        dpd   = abs(m["demographic_parity_diff"])
        dir_r = m["disparate_impact_ratio"]
        eod   = abs(m["equal_opportunity_diff"])

        if dir_r < DIR_THRESHOLD:
            sev = "HIGH" if dir_r < 0.6 else "MEDIUM"
            flags.append(dict(
                attribute=attr, severity=sev, metric="disparate_impact_ratio",
                value=round(dir_r, 4), threshold=DIR_THRESHOLD,
                message=f"'{attr}': disparate impact {dir_r:.3f} < {DIR_THRESHOLD} (80% rule)"
            ))
        if dpd > DPD_THRESHOLD:
            sev = "HIGH" if dpd > 0.2 else "MEDIUM"
            flags.append(dict(
                attribute=attr, severity=sev, metric="demographic_parity_diff",
                value=round(dpd, 4), threshold=DPD_THRESHOLD,
                message=f"'{attr}': demographic parity gap {dpd:.3f} > {DPD_THRESHOLD}"
            ))
        if eod > EOD_THRESHOLD:
            flags.append(dict(
                attribute=attr, severity="MEDIUM", metric="equal_opportunity_diff",
                value=round(eod, 4), threshold=EOD_THRESHOLD,
                message=f"'{attr}': equal opportunity gap {eod:.3f} > {EOD_THRESHOLD}"
            ))

    severity_rank = {"HIGH": 2, "MEDIUM": 1, "LOW": 0}
    return sorted(flags, key=lambda f: severity_rank[f["severity"]], reverse=True)


# ── Unlearn candidate selection ────────────────────────────────────────────────
def find_unlearn_candidates(
    model: LogisticRegression,
    X_train: np.ndarray,
    prot_train: np.ndarray,
    attr_names: list[str],
) -> dict[str, list[int]]:
    """
    For each protected attribute, select training samples to unlearn.

    Strategy
    --------
    High-confidence positive predictions in the privileged group inflate
    P(ŷ=1|privileged) and widen the demographic parity gap.  We rank them
    by descending confidence and select the minimum number needed to bring
    the gap below DPD_THRESHOLD — capped at MAX_UNLEARN_PCT of the training
    set to preserve overall model utility.
    """
    probs      = model.predict_proba(X_train)[:, 1]
    max_remove = max(1, int(len(X_train) * MAX_UNLEARN_PCT))
    candidates: dict[str, list[int]] = {}

    for col, attr in enumerate(attr_names):
        priv_mask  = prot_train[:, col] == 1
        priv_idx   = np.where(priv_mask)[0]
        priv_probs = probs[priv_idx]

        high_conf_mask  = priv_probs >= CANDIDATE_SCORE
        high_conf_idx   = priv_idx[high_conf_mask]
        high_conf_probs = priv_probs[high_conf_mask]
        order           = np.argsort(-high_conf_probs)
        sorted_cands    = high_conf_idx[order]

        ppr_priv   = float((probs[priv_mask]  >= 0.5).mean())
        ppr_unpriv = float((probs[~priv_mask] >= 0.5).mean())
        gap        = max(0.0, ppr_priv - ppr_unpriv - DPD_THRESHOLD)
        n_remove   = min(
            int(np.ceil(gap * priv_mask.sum())),
            len(sorted_cands),
            max_remove,
        )
        candidates[attr] = sorted_cands[:n_remove].tolist()

    return candidates


# ── Code-fix recommendations ───────────────────────────────────────────────────
_BIAS_TYPE_BY_METRIC = {
    "disparate_impact_ratio":  "disparate_impact",
    "demographic_parity_diff": "demographic_parity",
    "equal_opportunity_diff":  "equal_opportunity",
}
_SEVERITY_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}


def _dominant_bias_type(flags: list[dict]) -> str:
    """Pick the bias_type from the most-severe flag, default to demographic_parity."""
    if not flags:
        return "demographic_parity"
    worst = max(flags, key=lambda f: _SEVERITY_RANK.get(f.get("severity", "LOW"), 0))
    return _BIAS_TYPE_BY_METRIC.get(worst.get("metric", ""), "demographic_parity")


def generate_recommendations(flags: list[dict], attr_names: list[str]) -> list[dict]:
    """
    Return ranked recommendations with copy-paste code snippets.
    The VS Code extension renders these as inline suggestions.

    Each rec is enriched with a `social_context` field via Backboard's web search
    so the UI can show real-world precedent for the bias being addressed. The
    enrichment fails soft — an empty SocialContext (no API key, network down,
    bad response) leaves the rec usable.
    """
    flagged  = list({f["attribute"] for f in flags})
    primary  = flagged[0] if flagged else (attr_names[0] if attr_names else "sex")
    hit      = {f["metric"] for f in flags}
    fallback_bias_type = _dominant_bias_type(flags)
    recs     = []

    if "disparate_impact_ratio" in hit:
        recs.append({
            "priority": 1, "type": "reweighting",
            "bias_type": "disparate_impact",
            "protected_attribute": primary,
            "description": (
                "Apply per-(class, group) sample weights so the optimizer sees a "
                "balanced representation of each group during training."
            ),
            "code": textwrap.dedent(f"""\
                from sklearn.utils.class_weight import compute_sample_weight

                # Joint stratum: class label + protected group membership
                strata  = y_train.astype(str) + "_" + protected_train["{primary}"].astype(str)
                weights = compute_sample_weight("balanced", strata)

                model = LogisticRegression(max_iter=1000)
                model.fit(X_train, y_train, sample_weight=weights)
            """),
        })

    if "demographic_parity_diff" in hit:
        recs.append({
            "priority": 2, "type": "resampling",
            "bias_type": "demographic_parity",
            "protected_attribute": primary,
            "description": (
                "Oversample the underprivileged group with SMOTE to balance the "
                "training distribution before fitting."
            ),
            "code": textwrap.dedent(f"""\
                from imblearn.over_sampling import SMOTE

                # Encode (label × protected group) into a 4-class joint label, then oversample
                joint           = y_train * 2 + protected_train["{primary}"]
                smote           = SMOTE(random_state=42)
                X_res, joint_res = smote.fit_resample(X_train, joint)
                y_res           = (joint_res // 2).astype(int)

                model = LogisticRegression(max_iter=1000)
                model.fit(X_res, y_res)
            """),
        })

    recs.append({
        "priority": 3, "type": "threshold_adjustment",
        "bias_type": fallback_bias_type,
        "protected_attribute": primary,
        "description": (
            "Calibrate a separate classification threshold per group on a validation "
            "set to equalize positive prediction rates at inference time — no retraining needed."
        ),
        "code": textwrap.dedent(f"""\
            import numpy as np

            probs       = model.predict_proba(X_val)[:, 1]
            target_rate = 0.30   # desired positive rate — tune for your use-case

            thresholds = {{}}
            for group in [0, 1]:
                mask              = protected_val["{primary}"] == group
                thresholds[group] = np.percentile(probs[mask], 100 * (1 - target_rate))

            def predict_fair(X_new, prot_col):
                p   = model.predict_proba(X_new)[:, 1]
                out = np.zeros(len(X_new), dtype=int)
                for g, t in thresholds.items():
                    m      = prot_col == g
                    out[m] = (p[m] >= t).astype(int)
                return out
        """),
    })

    recs.append({
        "priority": 4, "type": "fairness_constraints",
        "bias_type": fallback_bias_type,
        "protected_attribute": primary,
        "description": (
            "Use Fairlearn's ExponentiatedGradient with a DemographicParity constraint "
            "to enforce fairness directly during training."
        ),
        "code": textwrap.dedent(f"""\
            from fairlearn.reductions import ExponentiatedGradient, DemographicParity
            from sklearn.linear_model import LogisticRegression

            mitigator = ExponentiatedGradient(
                LogisticRegression(max_iter=1000),
                DemographicParity(),
            )
            mitigator.fit(X_train, y_train, sensitive_features=protected_train["{primary}"])
            y_pred_fair = mitigator.predict(X_test)
        """),
    })

    for rec in recs:
        diff_summary = f"{rec['description']}\n\n{rec['code']}"
        rec["social_context"] = get_social_context(
            diff_summary=diff_summary,
            bias_type=rec["bias_type"],
            protected_attr=rec["protected_attribute"],
        ).to_dict()

    return recs


# ── Console report ─────────────────────────────────────────────────────────────
def print_report(report: dict) -> None:
    W  = 60
    ds = report["dataset"]
    bl = report["baseline"]
    pu = report.get("post_unlearn", {})

    print(f"\n{'='*W}")
    print("  BIAS AUDIT REPORT")
    print(f"{'='*W}")
    print(f"\nDataset : {ds['path']}  "
          f"({ds['n_samples']} samples, {ds['n_features']} features)")
    print(f"Split   : {ds['n_train']} train / {ds['n_test']} test")
    print(f"\nBaseline accuracy : {bl['accuracy']:.4f}  (predicting ScoreText='{POSITIVE_LABEL}')")

    for attr, m in bl["metrics"].items():
        print(f"\n  [{attr.upper()}]")
        print(f"    Positive rate  --  privileged: {m['positive_rate_privileged']:.3f}  "
              f"unprivileged: {m['positive_rate_unprivileged']:.3f}")
        print(f"    Demographic parity diff : {m['demographic_parity_diff']:+.3f}  "
              f"(threshold +/-{DPD_THRESHOLD})")
        print(f"    Disparate impact ratio  : {m['disparate_impact_ratio']:.3f}  "
              f"(threshold >={DIR_THRESHOLD})")
        print(f"    Equal opportunity diff  : {m['equal_opportunity_diff']:+.3f}  "
              f"(threshold +/-{EOD_THRESHOLD})")

    print(f"\n  BIAS FLAGS  ({len(report['bias_flags'])})")
    for flag in report["bias_flags"]:
        print(f"    [{flag['severity']:<6}] {flag['message']}")
    if not report["bias_flags"]:
        print("    None -- all metrics within thresholds")

    n_cands = sum(len(v) for v in report["unlearn_candidates"].values())
    print(f"\nUnlearn candidates : {n_cands} training samples flagged")

    if pu:
        delta = pu["accuracy"] - bl["accuracy"]
        print(f"\nPost-unlearn accuracy : {pu['accuracy']:.4f}  (delta = {delta:+.4f})")
        for attr, m in pu["metrics"].items():
            print(f"  [{attr.upper()}]  DPD: {m['demographic_parity_diff']:+.3f}  "
                  f"DIR: {m['disparate_impact_ratio']:.3f}  "
                  f"EOD: {m['equal_opportunity_diff']:+.3f}")

    print(f"\n  RECOMMENDATIONS  ({len(report['recommendations'])})")
    for rec in report["recommendations"]:
        print(f"    [{rec['priority']}] {rec['type']:<25} {rec['description'][:55]}...")

    print(f"\nFull report  ->  {REPORT_PATH}")


# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 1. Load
    print(f"Loading: {DATASET_PATH}")
    X, y, protected, attr_names = load_and_preprocess(DATASET_PATH)
    print(f"Scale   : {SCALE_FILTER}")
    print(f"Dataset : {X.shape[0]} samples, {X.shape[1]} features  "
          f"|  Protected attributes: {attr_names}")

    X_train, X_test, y_train, y_test, prot_train, prot_test = train_test_split(
        X, y, protected, test_size=0.2, random_state=RANDOM_STATE
    )

    # 2. Baseline model + bias audit
    print("\nTraining baseline LogisticRegression...")
    baseline = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
    baseline.fit(X_train, y_train)
    y_pred_base = baseline.predict(X_test)
    base_acc    = accuracy_score(y_test, y_pred_base)
    base_metrics = compute_bias_metrics(y_test, y_pred_base, prot_test, attr_names)
    flags        = flag_bias(base_metrics)

    # 3. Select unlearn candidates based on bias analysis
    candidates    = find_unlearn_candidates(baseline, X_train, prot_train, attr_names)
    all_candidates = sorted({idx for ids in candidates.values() for idx in ids})

    # 4. SISA training + targeted unlearning
    sisa = SISA(X_train, y_train)
    sisa.train()

    post_metrics, post_acc = base_metrics, base_acc
    if all_candidates:
        print(f"\nUnlearning {len(all_candidates)} bias-contributing samples via SISA...")
        sisa.unlearn(all_candidates)
        y_pred_post  = sisa.predict(X_test)
        post_acc     = accuracy_score(y_test, y_pred_post)
        post_metrics = compute_bias_metrics(y_test, y_pred_post, prot_test, attr_names)
    else:
        print("\nNo unlearn candidates identified -- bias within thresholds.")

    # 5. Ranked code-fix recommendations
    recommendations = generate_recommendations(flags, attr_names)

    # 6. Assemble JSON report for the VS Code extension
    report = {
        "dataset": {
            "path": DATASET_PATH,
            "n_samples": int(len(X)),
            "n_features": int(X.shape[1]),
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        },
        "protected_attributes": attr_names,
        "baseline": {
            "accuracy": round(float(base_acc), 4),
            "metrics": base_metrics,
        },
        "bias_flags": flags,
        "unlearn_candidates": {k: v for k, v in candidates.items()},
        "post_unlearn": {
            "accuracy": round(float(post_acc), 4),
            "metrics": post_metrics,
        },
        "recommendations": recommendations,
    }

    with open(REPORT_PATH, "w") as fh:
        json.dump(report, fh, indent=2)

    print_report(report)
