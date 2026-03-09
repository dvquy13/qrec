"""Shared utilities for eval scripts."""
import random
import re
from pathlib import Path
from typing import List, TypedDict


class QueryItem(TypedDict):
    query: str        # search string sent to QMD — diverse styles
    rationale: str    # why a future dev would search this


class QuerySet(TypedDict):
    queries: List[QueryItem]
    hard: bool        # True = session too thin to yield good eval queries


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    meta = {}
    for line in text[4:end].splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    return meta, text[end + 5:]


def discover_sessions(vault_dir: Path, max_sessions: int, seed: int) -> list[dict]:
    MIN_BODY_CHARS = 800
    all_sessions = []
    for md_path in sorted(vault_dir.glob("**/*.md")):
        text = md_path.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        if len(body.strip()) < MIN_BODY_CHARS:
            continue
        m = re.search(r"[0-9a-f]{8}$", md_path.stem)
        if not m:
            continue
        all_sessions.append(
            {
                "vault_file": str(md_path.relative_to(vault_dir)),
                "vault_path": str(md_path),
                "session_id_short": m.group(0),
                "session_id": meta.get("session_id", ""),
                "project": meta.get("project", "unknown"),
                "date": meta.get("started_at", "")[:10],
                "body": body,
            }
        )

    rng = random.Random(seed)
    rng.shuffle(all_sessions)
    by_project: dict[str, list] = {}
    for s in all_sessions:
        by_project.setdefault(s["project"], []).append(s)
    max_per_project = max(3, max_sessions // max(1, len(by_project)))
    capped = []
    for proj_sessions in by_project.values():
        capped.extend(proj_sessions[:max_per_project])
    rng.shuffle(capped)
    return capped[:max_sessions]
