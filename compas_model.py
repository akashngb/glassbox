"""
COMPAS recidivism risk model.

Trains a classifier on the ProPublica two-year COMPAS dataset to predict
whether a defendant will be re-arrested within two years (`two_year_recid`),
then ranks individuals by predicted risk and writes the top decile to
`compas_high_risk.csv`.

Filters follow the ProPublica methodology
(https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm/):

  * |days_b_screening_arrest| <= 30   — drop cases where the COMPAS screening
    is not clearly tied to the charge of interest
  * is_recid != -1                    — drop rows with no recidivism data
  * c_charge_degree != "O"            — drop ordinary traffic offenses
  * score_text != "N/A"               — drop missing COMPAS scores
"""
import json
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ── Config ─────────────────────────────────────────────────────────────────────
DATA_PATH      = "compas-repo/compas-scores-two-years.csv"
TARGET         = "two_year_recid"
HIGH_RISK_OUT  = "compas_high_risk.csv"
METRICS_OUT    = "compas_metrics.json"
RANDOM_STATE   = 42
TEST_SIZE      = 0.2
HIGH_RISK_PCT  = 0.10   # flag the top 10% of predicted probabilities

NUMERIC_FEATURES = [
    "age", "priors_count",
    "juv_fel_count", "juv_misd_count", "juv_other_count",
]
CATEGORICAL_FEATURES = ["sex", "race", "c_charge_degree", "age_cat"]
ID_COLUMNS = ["id", "name", "first", "last"]


def load_compas(path: str) -> pd.DataFrame:
    """Load and filter the ProPublica two-year COMPAS dataset."""
    df = pd.read_csv(path)
    df = df[
        (df["days_b_screening_arrest"] <= 30)
        & (df["days_b_screening_arrest"] >= -30)
        & (df["is_recid"] != -1)
        & (df["c_charge_degree"] != "O")
        & (df["score_text"] != "N/A")
    ].copy()
    df.reset_index(drop=True, inplace=True)
    return df


def build_pipeline() -> Pipeline:
    pre = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )
    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        random_state=RANDOM_STATE,
    )
    return Pipeline([("pre", pre), ("clf", clf)])


def per_group_recall(y_true: np.ndarray, y_pred: np.ndarray, groups: pd.Series) -> dict:
    """Recall (true-positive rate) per group — a standard COMPAS fairness lens."""
    out = {}
    for g in groups.unique():
        mask = groups == g
        if mask.sum() == 0:
            continue
        yt, yp = y_true[mask], y_pred[mask]
        pos = yt == 1
        tpr = float(yp[pos].mean()) if pos.any() else 0.0
        fpr = float(yp[~pos].mean()) if (~pos).any() else 0.0
        out[g] = {
            "n":   int(mask.sum()),
            "tpr": round(tpr, 4),
            "fpr": round(fpr, 4),
            "positive_rate": round(float(yp.mean()), 4),
        }
    return out


def main() -> None:
    print(f"Loading {DATA_PATH}")
    df = load_compas(DATA_PATH)
    print(f"After ProPublica filters: {len(df)} rows")

    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = df[feature_cols]
    y = df[TARGET].astype(int).values

    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, df.index.values,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    print("Training GradientBoostingClassifier...")
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)

    proba_test = pipe.predict_proba(X_test)[:, 1]
    pred_test  = (proba_test >= 0.5).astype(int)

    acc = accuracy_score(y_test, pred_test)
    auc = roc_auc_score(y_test, proba_test)
    cm  = confusion_matrix(y_test, pred_test).tolist()

    print(f"\nAccuracy : {acc:.4f}")
    print(f"ROC-AUC  : {auc:.4f}")
    print("Confusion matrix [[TN, FP], [FN, TP]]:")
    print(np.array(cm))
    print("\n" + classification_report(y_test, pred_test, target_names=["no recid", "recid"]))

    race_groups = df.loc[idx_test, "race"].reset_index(drop=True)
    sex_groups  = df.loc[idx_test, "sex"].reset_index(drop=True)
    by_race = per_group_recall(y_test, pred_test, race_groups)
    by_sex  = per_group_recall(y_test, pred_test, sex_groups)

    print("Per-race rates (TPR = recall on actual reoffenders, FPR = false-alarm on non-reoffenders):")
    for g, m in by_race.items():
        print(f"  {g:<18} n={m['n']:<5} TPR={m['tpr']:.3f}  FPR={m['fpr']:.3f}  pos_rate={m['positive_rate']:.3f}")

    # Score the full dataset and rank by predicted risk
    full_proba = pipe.predict_proba(X)[:, 1]
    df_scored = df.assign(risk_score=full_proba).sort_values("risk_score", ascending=False)
    cutoff_idx = max(1, int(len(df_scored) * HIGH_RISK_PCT))
    high_risk = df_scored.head(cutoff_idx)

    keep = [c for c in (ID_COLUMNS + feature_cols + ["decile_score", "score_text", TARGET, "risk_score"])
            if c in high_risk.columns]
    high_risk[keep].to_csv(HIGH_RISK_OUT, index=False)
    print(f"\nWrote top {HIGH_RISK_PCT:.0%} ({len(high_risk)} individuals) to {HIGH_RISK_OUT}")

    metrics = {
        "n_total":       int(len(df)),
        "n_train":       int(len(X_train)),
        "n_test":        int(len(X_test)),
        "accuracy":      round(float(acc), 4),
        "roc_auc":       round(float(auc), 4),
        "confusion_matrix": cm,
        "high_risk_threshold": float(df_scored["risk_score"].iloc[cutoff_idx - 1]),
        "tpr_fpr_by_race": by_race,
        "tpr_fpr_by_sex":  by_sex,
    }
    with open(METRICS_OUT, "w") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"Wrote evaluation metrics to {METRICS_OUT}")


if __name__ == "__main__":
    main()
