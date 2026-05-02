"""
UCI Adult (Census Income) classifier.

Trains a classifier on the UCI Adult dataset (https://archive.ics.uci.edu/dataset/2/adult)
to predict whether an individual earns >$50K/year, then ranks individuals by
predicted income probability and writes the top decile to `adult_high_income.csv`.

The dataset has well-known demographic skews (sex, race, native-country), so we
report per-group TPR/FPR as a fairness lens, mirroring the COMPAS pipeline.
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
TRAIN_PATH       = "adult-data/adult.data"
TEST_PATH        = "adult-data/adult.test"
TARGET           = "income"
HIGH_INCOME_OUT  = "adult_high_income.csv"
METRICS_OUT      = "adult_metrics.json"
RANDOM_STATE     = 42
HIGH_INCOME_PCT  = 0.10   # flag the top 10% of predicted probabilities

COLUMNS = [
    "age", "workclass", "fnlwgt", "education", "education_num",
    "marital_status", "occupation", "relationship", "race", "sex",
    "capital_gain", "capital_loss", "hours_per_week", "native_country",
    "income",
]

NUMERIC_FEATURES = [
    "age", "fnlwgt", "education_num",
    "capital_gain", "capital_loss", "hours_per_week",
]
CATEGORICAL_FEATURES = [
    "workclass", "education", "marital_status", "occupation",
    "relationship", "race", "sex", "native_country",
]


def load_adult(path: str, skiprows: int = 0) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        header=None,
        names=COLUMNS,
        skipinitialspace=True,
        skiprows=skiprows,
        na_values="?",
    )
    # adult.test has a trailing '.' on each label; normalize.
    df["income"] = df["income"].str.rstrip(".").str.strip()
    df = df.dropna().reset_index(drop=True)
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
    out = {}
    for g in groups.unique():
        mask = (groups == g).values
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
    print(f"Loading {TRAIN_PATH} and {TEST_PATH}")
    train_df = load_adult(TRAIN_PATH)
    test_df  = load_adult(TEST_PATH, skiprows=1)  # first line is a comment
    df = pd.concat([train_df, test_df], ignore_index=True)
    print(f"After dropping rows with '?': {len(df)} rows "
          f"(train={len(train_df)}, test={len(test_df)})")

    feature_cols = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = df[feature_cols]
    y = (df[TARGET] == ">50K").astype(int).values

    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, df.index.values,
        test_size=0.2,
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
    print("\n" + classification_report(y_test, pred_test, target_names=["<=50K", ">50K"]))

    race_groups = df.loc[idx_test, "race"].reset_index(drop=True)
    sex_groups  = df.loc[idx_test, "sex"].reset_index(drop=True)
    by_race = per_group_recall(y_test, pred_test, race_groups)
    by_sex  = per_group_recall(y_test, pred_test, sex_groups)

    print("Per-race rates (TPR = recall on actual >50K, FPR = false-alarm on <=50K):")
    for g, m in by_race.items():
        print(f"  {g:<22} n={m['n']:<5} TPR={m['tpr']:.3f}  FPR={m['fpr']:.3f}  pos_rate={m['positive_rate']:.3f}")
    print("Per-sex rates:")
    for g, m in by_sex.items():
        print(f"  {g:<22} n={m['n']:<5} TPR={m['tpr']:.3f}  FPR={m['fpr']:.3f}  pos_rate={m['positive_rate']:.3f}")

    full_proba = pipe.predict_proba(X)[:, 1]
    df_scored = df.assign(income_score=full_proba).sort_values("income_score", ascending=False)
    cutoff_idx = max(1, int(len(df_scored) * HIGH_INCOME_PCT))
    high_income = df_scored.head(cutoff_idx)

    keep = [c for c in (feature_cols + [TARGET, "income_score"]) if c in high_income.columns]
    high_income[keep].to_csv(HIGH_INCOME_OUT, index=False)
    print(f"\nWrote top {HIGH_INCOME_PCT:.0%} ({len(high_income)} individuals) to {HIGH_INCOME_OUT}")

    metrics = {
        "n_total":       int(len(df)),
        "n_train":       int(len(X_train)),
        "n_test":        int(len(X_test)),
        "accuracy":      round(float(acc), 4),
        "roc_auc":       round(float(auc), 4),
        "confusion_matrix": cm,
        "high_income_threshold": float(df_scored["income_score"].iloc[cutoff_idx - 1]),
        "tpr_fpr_by_race": by_race,
        "tpr_fpr_by_sex":  by_sex,
    }
    with open(METRICS_OUT, "w") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"Wrote evaluation metrics to {METRICS_OUT}")


if __name__ == "__main__":
    main()
