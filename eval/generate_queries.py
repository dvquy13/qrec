# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic", "claude-agent-sdk", "anyio", "python-dotenv", "loguru"]
# ///
"""
Phase 1, Step 1: Generate candidate eval queries from vault sessions (two-stage).

Stage 1 (Haiku): Generate 2-5 queries per session in mixed styles.
Stage 2 (Haiku): Prune + add missing styles. Output is the final QuerySet.

Two backends:
  agent  (default) — claude-agent-sdk, concurrent, fast feedback, no API key needed
  batch            — Anthropic Batch API, ~10-20 min, 50% cheaper, needs ANTHROPIC_API_KEY

Typical usage:
  uv run eval/generate_queries.py --max-sessions 5
  uv run eval/generate_queries.py --backend batch --max-sessions 60
"""

import argparse
import json
import sys
from datetime import datetime
from functools import partial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from llm_backend import AgentBackend, BatchBackend, UsageMeta
from logging_setup import setup_logging
from loguru import logger
from response_cache import ResponseCache
from run_config import RunConfig
from utils import QueryItem, QuerySet, discover_sessions


VAULT_DIR = Path.home() / "vault" / "sessions"
PROMPTS_DIR = Path(__file__).parent / "prompts"

# ---------------------------------------------------------------------------
# Prompt loading
# ---------------------------------------------------------------------------


def load_prompt(version: str, stage: str) -> str:
    """Load prompt template from eval/prompts/{version}_{stage}.txt."""
    path = PROMPTS_DIR / f"{version}_{stage}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "queries": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "rationale": {"type": "string"},
                    "style": {
                        "type": "string",
                        "enum": ["full-question", "keyword-soup", "action-phrase", "short-concept"],
                        "description": "Query style: full-question (how/why/what), keyword-soup (space-separated terms), action-phrase (verb+object), short-concept (≤3 words)",
                    },
                },
                "required": ["query", "rationale", "style"],
                "additionalProperties": False,
            },
        },
        "hard": {
            "type": "boolean",
            "description": "True if session has no substantive learnings worth querying",
        },
    },
    "required": ["queries", "hard"],
    "additionalProperties": False,
}

def build_stage1_prompt(session: dict, template: str) -> str:
    body = session["body"]
    if len(body) > 6000:
        body = body[:6000] + "\n\n[... session truncated ...]"
    return template.format(
        project=session["project"],
        date=session["date"] or "unknown",
        session_text=body.strip(),
    )


def build_stage2_prompt(session: dict, template: str) -> str:
    """session must include 'stage1_result' (QuerySet).
    Uses 'original_body' if present (pipeline sets this to keep body free for cache keying).
    """
    body = session.get("original_body") or session["body"]
    if len(body) > 6000:
        body = body[:6000] + "\n\n[... session truncated ...]"
    stage1_result: QuerySet = session["stage1_result"]
    queries_text = "\n".join(
        f"  - {q['query']}" for q in stage1_result.get("queries", [])
    ) or "  (no queries generated)"
    return template.format(
        project=session["project"],
        date=session["date"] or "unknown",
        session_text=body.strip(),
        stage1_queries=queries_text,
    )


# ---------------------------------------------------------------------------
# Stage runner (cache-aware)
# ---------------------------------------------------------------------------


def run_stage(
    stage: str,
    sessions: list[dict],
    prompt_fn,
    config: RunConfig,
    schema: dict,
    backend,
    cache: ResponseCache,
) -> dict[str, QuerySet]:
    """
    Run one stage for all sessions, using cache for previously seen ones.
    Returns {session_id_short: QuerySet}.
    """
    pending = []
    results: dict[str, QuerySet] = {}

    for session in sessions:
        key = f"{config.fingerprint()}_{ResponseCache.make_content_fingerprint(session['body'])}"
        hit = cache.get(key)
        if hit is not None:
            logger.debug(f"[{stage}] cache hit: {session['session_id_short']}")
            results[session["session_id_short"]] = hit
        else:
            pending.append(session)

    logger.info(
        f"[{stage}] {len(results)} cached, {len(pending)} pending "
        f"(backend={backend.__class__.__name__})"
    )

    if pending:
        raw_results = backend.complete_many(pending, prompt_fn, schema)
        ts = datetime.utcnow().isoformat()
        for session, (queryset, usage) in zip(pending, raw_results):
            sid = session["session_id_short"]
            key = f"{config.fingerprint()}_{ResponseCache.make_content_fingerprint(session['body'])}"
            cache.put(
                key,
                queryset,
                session_id=sid,
                stage=stage,
                model=backend.model,
                cost_usd=usage.get("cost_usd", 0.0),
                timestamp=ts,
                config_fingerprint=config.fingerprint(),
            )
            results[sid] = queryset
            q_count = len(queryset.get("queries", []))
            hard = queryset.get("hard", False)
            logger.info(
                f"[{stage}] {sid} ({session['project']}): "
                f"{q_count} queries, hard={hard}, "
                f"cost=${usage.get('cost_usd', 0):.5f}"
            )

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Generate eval queries from vault sessions (two-stage)"
    )
    parser.add_argument(
        "--backend",
        choices=["agent", "batch"],
        default="agent",
    )
    parser.add_argument("--vault-dir", default=str(VAULT_DIR))
    parser.add_argument("--max-sessions", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default="eval/data/candidate_queries.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--poll-interval", type=int, default=30)
    parser.add_argument("--prompt-version", default="v1", help="Prompt version (e.g. v1, v2)")
    args = parser.parse_args()

    stage1_template = load_prompt(args.prompt_version, "stage1")
    stage2_template = load_prompt(args.prompt_version, "stage2")

    run_id = datetime.utcnow().strftime("%Y-%m-%d_%H-%M")
    run_id, run_dir = setup_logging(run_id)
    bronze_path = run_dir / "responses.jsonl"
    cache = ResponseCache(bronze_path)

    backend = (
        AgentBackend()
        if args.backend == "agent"
        else BatchBackend(poll_interval=args.poll_interval)
    )

    config = RunConfig(
        model=backend.model,
        stage1_prompt=stage1_template,
        stage2_prompt=stage2_template,
    )

    sessions = discover_sessions(Path(args.vault_dir), args.max_sessions, args.seed)
    logger.info(f"Discovered {len(sessions)} sessions (seed={args.seed})")

    if args.dry_run:
        model = backend.model
        logger.info(f"Dry run: would submit up to {len(sessions)} × 2 requests to {model}")
        return

    # Stage 1
    stage1_results = run_stage(
        stage="stage1",
        sessions=sessions,
        prompt_fn=partial(build_stage1_prompt, template=stage1_template),
        config=config,
        schema=QUERY_SCHEMA,
        backend=backend,
        cache=cache,
    )

    # Stage 2: cache key uses stage1 output JSON as the "content"
    sessions_s2 = [
        {
            **s,
            "stage1_result": stage1_results[s["session_id_short"]],
            "body": json.dumps(stage1_results[s["session_id_short"]]),
            "original_body": s["body"],
        }
        for s in sessions
        if s["session_id_short"] in stage1_results
    ]
    stage2_results = run_stage(
        stage="stage2",
        sessions=sessions_s2,
        prompt_fn=partial(build_stage2_prompt, template=stage2_template),
        config=config,
        schema=QUERY_SCHEMA,
        backend=backend,
        cache=cache,
    )

    # Write output (candidate_queries.json)
    output = []
    for session in sessions:
        sid = session["session_id_short"]
        if sid not in stage2_results:
            continue
        qs = stage2_results[sid]
        output.append(
            {
                "vault_file": session["vault_file"],
                "session_id_short": sid,
                "session_id": session["session_id"],
                "project": session["project"],
                "date": session["date"],
                "queries": qs.get("queries", []),
                "hard": qs.get("hard", False),
            }
        )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))

    total_queries = sum(len(r["queries"]) for r in output)
    hard_count = sum(1 for r in output if r["hard"])
    logger.info(
        f"Done: {len(output)} sessions, {total_queries} queries, "
        f"{hard_count} hard → {out_path}"
    )


if __name__ == "__main__":
    main()
