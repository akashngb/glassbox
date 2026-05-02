"""Generate a static HTML preview of the 'Why this matters' panel.

Calls get_social_context() for a few representative bias-fix scenarios and
renders them into preview/index.html using the Glassbox palette + fonts.
This is a throwaway visualizer — it does not touch the React frontend.

Usage:
    python3 preview_social_context.py
    open preview/index.html
"""
from __future__ import annotations

import html
import json
import os
from pathlib import Path

from glassbox.bias import get_social_context


SCENARIOS = [
    {
        "id": "compas-threshold",
        "type": "threshold_adjustment",
        "severity": "HIGH",
        "bias_type": "equal_opportunity",
        "protected_attr": "race",
        "description": (
            "Per-group decision threshold for COMPAS recidivism: lower the positive-class "
            "threshold for the Black subgroup from 0.50 to 0.42 so true-positive rate "
            "matches the white subgroup."
        ),
    },
    {
        "id": "hiring-reweight",
        "type": "reweighting",
        "severity": "HIGH",
        "bias_type": "disparate_impact",
        "protected_attr": "sex",
        "description": (
            "Reweight training samples to balance (label, sex) strata so the gradient "
            "isn't dominated by the over-represented male-positive cohort."
        ),
    },
    {
        "id": "lending-smote",
        "type": "resampling",
        "severity": "MEDIUM",
        "bias_type": "demographic_parity",
        "protected_attr": "race",
        "description": (
            "SMOTE-oversample the minority race subgroup before fitting the loan-default "
            "classifier so the positive-prediction-rate gap closes from 0.18 to <0.05."
        ),
    },
]


SEVERITY_COLOR = {
    "HIGH":   ("#fca5a5", "#ef444433"),
    "MEDIUM": ("#fcd34d", "#f59e0b33"),
    "LOW":    ("#6ee7b7", "#10b98133"),
}

TYPE_COLOR = ("#cbd5e1", "#9aa0ab2a")
BIAS_COLOR = ("#ffd9a8", "#ffb86b33")


def _load_env() -> None:
    if os.getenv("BACKBOARD_API_KEY"):
        return
    env = Path(".env")
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def chip(label: str, fg: str, bg: str) -> str:
    return (
        f'<span class="chip" style="color:{fg};background:{bg};border-color:{fg}55;">'
        f"{html.escape(label)}</span>"
    )


def render_row(scenario: dict, ctx: dict) -> str:
    sev_fg, sev_bg = SEVERITY_COLOR.get(scenario["severity"], TYPE_COLOR)
    chips = [
        chip(scenario["severity"], sev_fg, sev_bg),
        chip(scenario["type"], *TYPE_COLOR),
        chip(scenario["bias_type"], *BIAS_COLOR),
        chip(f"attr: {scenario['protected_attr']}", *TYPE_COLOR),
    ]

    summary = ctx.get("summary") or "<em class=\"empty\">No social context returned (network or API key issue).</em>"
    summary_html = html.escape(summary) if ctx.get("summary") else summary

    precedent_chips = "".join(
        chip(case, "#e8eaee", "#262b35") for case in ctx.get("precedent_cases", [])
    ) or '<span class="empty">none</span>'

    articles_html = ""
    for art in ctx.get("articles", []):
        articles_html += f"""
        <li class="article">
          <a href="{html.escape(art['url'])}" target="_blank" rel="noopener" class="article-title">
            {html.escape(art['title'])}
          </a>
          <div class="article-meta">
            <span class="article-source">{html.escape(art.get('source', ''))}</span>
            <span class="article-rel">{html.escape(art.get('relevance', ''))}</span>
          </div>
        </li>"""
    if not articles_html:
        articles_html = '<li class="empty">No articles surfaced.</li>'

    return f"""
    <article class="rec">
      <header class="rec-head">
        <div class="rec-title">{html.escape(scenario['description'])}</div>
        <div class="chips">{''.join(chips)}</div>
      </header>
      <section class="why">
        <div class="why-label">Why this matters</div>
        <p class="summary">{summary_html}</p>
        <div class="why-grid">
          <div class="why-block">
            <div class="why-block-label">Precedent cases</div>
            <div class="chips">{precedent_chips}</div>
          </div>
          <div class="why-block">
            <div class="why-block-label">Sources</div>
            <ul class="articles">{articles_html}</ul>
          </div>
        </div>
      </section>
    </article>"""


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Glassbox · Why this matters preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {{
    --bg:        #0e1014;
    --surface:   #16191f;
    --elevated:  #1c2029;
    --border:    #262b35;
    --fg:        #e8eaee;
    --fg-muted:  #9aa0ab;
    --fg-subtle: #6b7280;
    --accent:    #ffb86b;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; background: var(--bg); color: var(--fg); }}
  body {{
    font-family: "Atkinson Hyperlegible", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 56px 64px 96px;
    max-width: 1180px;
    margin: 0 auto;
  }}
  h1 {{
    font-size: 36px;
    font-weight: 700;
    margin: 0 0 4px;
    letter-spacing: -0.02em;
  }}
  .breadcrumb {{
    color: var(--fg-subtle);
    font-size: 13px;
    margin-bottom: 6px;
  }}
  .subtitle {{
    color: var(--fg-muted);
    margin: 0 0 32px;
    font-size: 15px;
  }}

  .toolbar {{
    display: flex;
    gap: 8px;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
    margin-bottom: 0;
  }}
  .toolbar .tab {{
    font-size: 13px;
    color: var(--fg);
    background: var(--elevated);
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }}
  .toolbar .tab.active {{
    background: var(--surface);
    border-color: var(--fg-subtle);
  }}
  .toolbar .spacer {{ flex: 1; }}
  .toolbar .pill {{
    color: var(--fg);
    background: var(--accent);
    color: #1a1208;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
  }}

  table.grid {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 18px;
  }}
  .colhead {{
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: 12px;
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }}
  .colhead .c {{ display: inline-flex; align-items: center; gap: 6px; }}
  .colhead .c::before {{
    content: "";
    width: 8px; height: 8px;
    border: 1px solid currentColor;
    border-radius: 2px;
    opacity: 0.55;
  }}

  .rec {{
    border-bottom: 1px solid var(--border);
    padding: 18px 14px 22px;
  }}
  .rec:hover {{ background: #14171d; }}
  .rec-head {{
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 18px;
    align-items: start;
  }}
  .rec-title {{
    font-size: 15px;
    line-height: 1.45;
    color: var(--fg);
  }}
  .chips {{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }}
  .chip {{
    display: inline-block;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid;
    line-height: 1.4;
    white-space: nowrap;
  }}

  .why {{
    margin-top: 14px;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }}
  .why-label {{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 8px;
  }}
  .summary {{
    margin: 0 0 14px;
    color: var(--fg);
    font-size: 14px;
    line-height: 1.55;
  }}
  .why-grid {{
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 24px;
    align-items: start;
  }}
  .why-block-label {{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-muted);
    margin-bottom: 8px;
  }}
  .articles {{
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .article-title {{
    color: var(--fg);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid transparent;
  }}
  .article-title:hover {{
    color: var(--accent);
    border-bottom-color: var(--accent);
  }}
  .article-meta {{
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: var(--fg-muted);
    margin-top: 3px;
  }}
  .article-source {{
    font-family: "JetBrains Mono", ui-monospace, monospace;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-subtle);
    font-size: 11px;
  }}
  .article-rel {{ flex: 1; }}
  .empty {{ color: var(--fg-subtle); font-style: italic; font-size: 13px; }}

  .footer {{
    margin-top: 40px;
    color: var(--fg-subtle);
    font-size: 12px;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }}
</style>
</head>
<body>
  <div class="breadcrumb">glassbox / bias-audit / preview</div>
  <h1>Why this matters</h1>
  <p class="subtitle">Real-world social context for proposed bias fixes — surfaced via Backboard web search.</p>

  <div class="toolbar">
    <span class="tab active">Recommendations</span>
    <span class="tab">Metrics</span>
    <span class="tab">Splices</span>
    <span class="spacer"></span>
    <span class="pill">+ New audit</span>
  </div>

  <div class="colhead">
    <span class="c">recommendation</span>
    <span class="c">tags</span>
  </div>

  {rows}

  <div class="footer">{count} scenarios · BACKBOARD_API_KEY {key_state} · cached by (bias_type, protected_attr)</div>
</body>
</html>
"""


def main() -> None:
    _load_env()
    out_dir = Path("preview")
    out_dir.mkdir(exist_ok=True)

    rendered_rows = []
    raw_data = []
    for sc in SCENARIOS:
        print(f"fetching: {sc['id']}  ({sc['bias_type']}/{sc['protected_attr']})...")
        ctx = get_social_context(
            diff_summary=sc["description"],
            bias_type=sc["bias_type"],
            protected_attr=sc["protected_attr"],
        ).to_dict()
        raw_data.append({"scenario": sc, "context": ctx})
        rendered_rows.append(render_row(sc, ctx))

    (out_dir / "data.json").write_text(json.dumps(raw_data, indent=2))
    page = PAGE.format(
        rows="\n".join(rendered_rows),
        count=len(SCENARIOS),
        key_state="present" if os.getenv("BACKBOARD_API_KEY") else "missing",
    )
    out_path = out_dir / "index.html"
    out_path.write_text(page)
    print(f"\nWrote {out_path.resolve()}")
    print(f"Wrote {(out_dir / 'data.json').resolve()}")


if __name__ == "__main__":
    main()
