"""Backboard-backed social context lookup for SISA bias fixes.

Calls Backboard's `POST /threads/messages` with `web_search="Auto"` and asks the
model to return a JSON envelope of summary + articles + precedent cases. Built
to fail soft: any error path returns an empty SocialContext so it can never
block the diff flow.

API shape per https://backboard-docs.docsalot.dev/concepts/web-search.md:
  POST https://app.backboard.io/api/threads/messages
  Headers: X-API-Key: <key>
  Body:    {"content": str, "web_search": "Auto"}
  Returns: {"content": str, "thread_id": str, ...}
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

_API_URL = "https://app.backboard.io/api/threads/messages"
# Backboard's web-search calls measured ~12-13s end-to-end; 10s (the original
# spec) reliably truncated valid responses, so we give it a small buffer.
_TIMEOUT_SECONDS = 20
_CACHE: dict[tuple[str, str], "SocialContext"] = {}


@dataclass
class Article:
    title: str
    url: str
    source: str
    relevance: str


@dataclass
class SocialContext:
    summary: str = ""
    articles: list[Article] = field(default_factory=list)
    precedent_cases: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_empty(self) -> bool:
        return not (self.summary or self.articles or self.precedent_cases)


def get_social_context(
    diff_summary: str, bias_type: str, protected_attr: str
) -> SocialContext:
    """Look up real-world context for a proposed bias fix.

    Cached by (bias_type, protected_attr) so re-running on the same dataset
    doesn't re-query. Returns an empty SocialContext on any failure.
    """
    cache_key = (bias_type, protected_attr)
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    api_key = os.getenv("BACKBOARD_API_KEY")
    if not api_key:
        return SocialContext()

    prompt = _build_prompt(diff_summary, bias_type, protected_attr)
    raw = _call_backboard(prompt, api_key)
    if raw is None:
        return SocialContext()

    context = _parse_response(raw)
    _CACHE[cache_key] = context
    return context


def _build_prompt(diff_summary: str, bias_type: str, protected_attr: str) -> str:
    return f"""You are helping an ML bias-auditing tool surface real-world context
for a proposed fix. Use web search to find recent, credible sources (major news
outlets, peer-reviewed papers, government reports) about the social impact of
this specific bias pattern.

Bias type: {bias_type}
Protected attribute: {protected_attr}
Proposed fix:
{diff_summary}

Return ONLY a single JSON object — no prose before or after — with this shape:

{{
  "summary": "2-3 sentence plain-English explanation of why this kind of bias matters, grounded in real cases",
  "articles": [
    {{
      "title": "...",
      "url": "https://...",
      "source": "publication or institution name",
      "relevance": "one sentence on why this article is relevant"
    }}
  ],
  "precedent_cases": ["COMPAS", "Optum risk scoring", "Amazon hiring tool"]
}}

Limit articles to at most 3. Only include precedent_cases that genuinely
resemble this bias pattern; leave the list empty if none apply. Prefer sources
from the last 5 years."""


def _call_backboard(prompt: str, api_key: str) -> str | None:
    body = json.dumps({"content": prompt, "web_search": "Auto"}).encode("utf-8")
    req = urllib_request.Request(
        _API_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        },
    )
    try:
        with urllib_request.urlopen(req, timeout=_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib_error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None

    content = payload.get("content")
    return content if isinstance(content, str) and content.strip() else None


def _parse_response(raw: str) -> SocialContext:
    data = _extract_json_object(raw)
    if data is None:
        return SocialContext()

    summary = data.get("summary", "")
    summary = summary.strip() if isinstance(summary, str) else ""

    articles: list[Article] = []
    for item in (data.get("articles") or [])[:3]:
        if not isinstance(item, dict):
            continue
        url = item.get("url", "")
        title = item.get("title", "")
        if not (isinstance(url, str) and url.startswith("http") and isinstance(title, str) and title):
            continue
        articles.append(
            Article(
                title=title,
                url=url,
                source=str(item.get("source", "")),
                relevance=str(item.get("relevance", "")),
            )
        )

    precedent_cases: list[str] = []
    for case in data.get("precedent_cases") or []:
        if isinstance(case, str) and case.strip():
            precedent_cases.append(case.strip())

    return SocialContext(
        summary=summary, articles=articles, precedent_cases=precedent_cases
    )


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    """Models sometimes wrap JSON in prose or fences. Pull out the first object."""
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence:
        try:
            parsed = json.loads(fence.group(1))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        try:
            parsed = json.loads(raw[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None
