"""Smoke test for glassbox.bias.social_context.

Run with: python test_social_context.py
Loads BACKBOARD_API_KEY from .env if not already in the environment.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from glassbox.bias import get_social_context


def _load_env() -> None:
    if os.getenv("BACKBOARD_API_KEY"):
        return
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> None:
    _load_env()

    diff_summary = (
        "Per-group decision threshold for the COMPAS recidivism model: lower the "
        "positive-class threshold for the Black subgroup from 0.50 to 0.42 so the "
        "true-positive rate matches the white subgroup. Reduces equal-opportunity "
        "difference from 0.18 to 0.03; demographic-parity difference from 0.21 to 0.05."
    )

    ctx = get_social_context(
        diff_summary=diff_summary,
        bias_type="equal_opportunity_violation",
        protected_attr="race",
    )

    print(json.dumps(ctx.to_dict(), indent=2))
    print()
    if ctx.is_empty:
        print("Empty SocialContext returned — check BACKBOARD_API_KEY, network, or model output.")
    else:
        print(
            f"OK — summary: {len(ctx.summary)} chars, "
            f"articles: {len(ctx.articles)}, "
            f"precedent_cases: {len(ctx.precedent_cases)}"
        )


if __name__ == "__main__":
    main()
