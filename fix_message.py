"""
fix_message.py — feeds retune.json + bias_report.json into Gemini and asks it
to write a plain-English summary of the bias findings and code-fix rationale,
with links to relevant articles.

Usage:
    set GEMINI_API_KEY=your_key_here
    python fix_message.py

Writes the generated message to fix_message.md and prints it to stdout.
"""
import json
import os
import sys

from google import genai
from dotenv import load_dotenv

load_dotenv()

RETUNE_PATH  = "retune.json"
REPORT_PATH  = "bias_report.json"
OUTPUT_PATH  = "fix_message.md"
MODEL        = "gemini-2.5-flash"


def load_json(path: str) -> dict:
    with open(path) as fh:
        return json.load(fh)


def build_prompt(report: dict, retune: dict) -> str:
    ds       = report["dataset"]
    bl       = report["baseline"]
    flags    = report["bias_flags"]
    recs     = report["recommendations"]
    params   = retune["predicted_params"]
    rationale = retune["rationale"]

    flag_lines = "\n".join(
        f"  - [{f['severity']}] {f['attribute']} / {f['metric']}: "
        f"value={f['value']} (threshold={f['threshold']}) — {f['message']}"
        for f in flags
    )
    rationale_lines = "\n".join(f"  - {r}" for r in rationale)
    rec_lines = "\n".join(
        f"  - Priority {r['priority']} ({r['type']}): {r['description']}"
        for r in recs
    )
    param_lines = "\n".join(f"  {k} = {v}" for k, v in params.items())

    return f"""You are an AI ethics and fairness expert reviewing a bias audit of the ProPublica COMPAS recidivism dataset.

Below is the output of a bias-analysis pipeline (sisa.py) and a parameter-tuning recommendation engine (retune.py). Your task is to write a clear, well-structured summary message aimed at a technical audience (data scientists, ML engineers) that:

1. Explains what bias was found and why it matters in the context of criminal justice / recidivism prediction.
2. Explains the reasoning behind each code-fix recommendation in plain English — not just what to do, but WHY each change specifically addresses the detected bias.
3. Provides 4–6 links to real, credible articles or papers about the impact of algorithmic bias in recidivism tools and/or the COMPAS dataset specifically.

Format your response as clean Markdown (use headers, bullet points, and a "Further Reading" section at the end).

---

DATASET: {ds['path']} — {ds['n_samples']} samples, {ds['n_train']} train / {ds['n_test']} test
BASELINE ACCURACY: {bl['accuracy']}

BIAS FLAGS DETECTED:
{flag_lines}

PARAMETER TUNING RATIONALE (from retune.py):
{rationale_lines}

RECOMMENDED PARAMETER VALUES:
{param_lines}

CODE-LEVEL FIX RECOMMENDATIONS (from sisa.py):
{rec_lines}

---

Write the summary now. Be specific about the numbers from the audit (e.g. disparate impact ratio of 0.0, equal opportunity gap of ~0.1). Do not be generic. Tie every recommendation directly back to a specific metric violation. For the article links, use real URLs to published papers, news investigations, or credible technical blogs — do not fabricate URLs."""


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set.", file=sys.stderr)
        print("Run:  set GEMINI_API_KEY=your_key_here", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {REPORT_PATH} and {RETUNE_PATH}...")
    report = load_json(REPORT_PATH)
    retune = load_json(RETUNE_PATH)

    prompt = build_prompt(report, retune)

    print(f"Calling Gemini ({MODEL})...")
    client   = genai.Client(api_key=api_key)
    response = client.models.generate_content(model=MODEL, contents=prompt)
    message  = response.text

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(message)

    print(f"\n{'='*62}")
    print(message)
    print(f"{'='*62}")
    print(f"\nWritten to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
