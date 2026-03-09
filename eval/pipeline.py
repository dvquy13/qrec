# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic", "claude-agent-sdk", "anyio", "python-dotenv", "loguru", "pyyaml"]
# ///
"""
End-to-end eval pipeline for qrec.

Usage:
  uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml

  # Generate queries only (no indexing/eval)
  uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml --generate-only

  # Override config values at CLI
  uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml --sessions 10 --seed 7

Stages:
  1. Load config YAML
  2. Query generation: sample sessions → check cache → call Haiku (batch/agent) for misses
  3. Index: bun run src/cli.ts index <vault> --sessions N --seed S
  4. Serve: bun run src/cli.ts serve --daemon
  5. Eval: HTTP loop against daemon → Found@10, NDCG@10, latency, RSS
  6. Stop daemon
  7. Write results JSON + HTML report
"""

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from functools import partial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generate_queries import (
    QUERY_SCHEMA,
    build_stage1_prompt,
    build_stage2_prompt,
    load_prompt,
    run_stage,
)
from llm_backend import AgentBackend, BatchBackend
from logging_setup import setup_logging
from loguru import logger
from response_cache import ResponseCache
from run_config import RunConfig
from utils import discover_sessions
import qrec_eval
import report as report_gen

VAULT_DIR   = Path.home() / "vault" / "sessions"
EVAL_DIR    = Path(__file__).parent
DATA_DIR    = EVAL_DIR / "data"
RESULTS_DIR = DATA_DIR / "results"


def get_git_hash() -> str:
    try:
        r = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True,
            cwd=EVAL_DIR.parent,
        )
        return r.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def print_summary(run_name: str, qg: dict, idx: dict, ev: dict, ea: dict, k: int,
                  results_path: Path, html_path: Path):
    def sym(ok, close=False):
        return "✓" if ok else ("~" if close else "✗")

    f10     = ev["found_at_k"]
    ndcg    = ev["ndcg_at_k"]
    p50     = ev["latency_p50_ms"]
    p95     = ev["latency_p95_ms"]
    rss_mb  = ev["rss_startup_kb"] // 1024

    print(f"\n{'='*60}")
    print(f"  PIPELINE SUMMARY — {run_name}")
    print(f"{'='*60}")
    print(f"  Query gen:   {qg['sessions_sampled']} sampled → {qg['sessions_generated']} generated"
          f"  |  {qg['cache_hits']} hits, {qg['cache_misses']} LLM calls (2 stages)")
    print(f"               cost ${qg['cost_usd']:.3f}  |  {qg['duration_s']:.1f}s"
          f"  |  backend={qg['backend']}")
    print(f"  Indexing:    {idx['sessions_indexed']} sessions, {idx['chunks_in_db']} chunks"
          f"  |  {idx['duration_s']}s")
    print(f"  RSS:         startup {ev['rss_startup_kb']//1024} MB"
          f"  →  post-eval {ev['rss_post_eval_kb']//1024} MB")
    print()
    print(f"  Found@{k}:    {f10*100:.1f}%   (target ≥90%)   {sym(f10>=0.90, f10>=0.837)}")
    print(f"  NDCG@{k}:     {ndcg:.4f}  (target ≥0.75)  {sym(ndcg>=0.75, ndcg>=0.70)}")
    print(f"  Latency p50: {p50:.0f}ms    (target <100ms)  {sym(p50<100)}")
    print(f"  Latency p95: {p95:.0f}ms    (target <300ms)  {sym(p95<300)}")
    print(f"  RSS startup: {rss_mb}MB    (target <500MB)  {sym(rss_mb<500)}")
    print(f"{'='*60}")
    print(f"  Missed: {ea['total_missed']}/{ev['queries_run']} queries")
    print(f"{'='*60}")

    if ea["groups"]:
        print("\n  ERROR ANALYSIS")
        print("  " + "─"*56)
        for diag, group in ea["groups"].items():
            print(f"\n  [{diag}]  {group['count']} quer{'y' if group['count']==1 else 'ies'}")
            print(f"  Hypothesis: {group['hypothesis']}")
            for q in group["queries"]:
                rank_str = f"rank #{q['rank_of_relevant']}" if q.get("rank_of_relevant") else "not retrieved"
                print(f"    • [{q['session_id']}] \"{q['query'][:60]}\" ({rank_str})")

    print(f"\n  Results: {results_path}")
    print(f"  Report:  {html_path}\n")


def main():
    parser = argparse.ArgumentParser(description="qrec end-to-end eval pipeline")
    parser.add_argument("--config",       required=True, help="Path to config YAML")
    parser.add_argument("--sessions",     type=int,      help="Override sessions count")
    parser.add_argument("--seed",         type=int,      help="Override seed")
    parser.add_argument("--backend",      choices=["agent", "batch"], help="Override backend")
    parser.add_argument("--vault-dir",    default=None,  help="Override vault directory")
    parser.add_argument("--k",            type=int,      help="Override eval k")
    parser.add_argument("--prompt-version", default=None)
    parser.add_argument("--generate-only", action="store_true",
                        help="Stop after writing queries, skip indexing and eval")
    args = parser.parse_args()

    # Load config
    config = RunConfig.from_yaml(Path(args.config))

    # CLI overrides
    if args.sessions:  config.indexing.sessions     = args.sessions
    if args.seed:      config.indexing.seed         = args.seed
    if args.backend:   config.query_gen.backend     = args.backend
    if args.k:         config.eval.k                = args.k
    if args.vault_dir: config.indexing.vault        = args.vault_dir
    pv = args.prompt_version or config.query_gen.prompt_version

    run_id = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
    _, run_dir = setup_logging(run_id)
    logger.info(f"Pipeline run: {run_id}  config={args.config}")
    logger.info(f"  sessions={config.indexing.sessions}  seed={config.indexing.seed}"
                f"  backend={config.query_gen.backend}  strategy={config.indexing.strategy}")

    vault_dir = Path(config.indexing.vault).expanduser()

    # ── Stage 1 + 2: query generation ─────────────────────────────────────────
    stage1_template = load_prompt(pv, "stage1")
    stage2_template = load_prompt(pv, "stage2")
    config.set_prompts(stage1_template, stage2_template)
    config.set_schema(QUERY_SCHEMA)  # schema changes must invalidate cache

    backend = (AgentBackend() if config.query_gen.backend == "agent"
               else BatchBackend(poll_interval=30))

    bronze_path = run_dir / "responses.jsonl"
    cache = ResponseCache(bronze_path)

    sessions = discover_sessions(vault_dir, config.indexing.sessions, config.indexing.seed)

    # discover_sessions project-caps; fill up to requested count if short
    requested = config.indexing.sessions
    if len(sessions) < requested:
        logger.warning(
            f"Project-cap returned {len(sessions)}/{requested} sessions — "
            f"filling from remaining qualifying sessions."
        )
        existing_ids = {s["session_id_short"] for s in sessions}
        all_sessions = discover_sessions(vault_dir, 9999, config.indexing.seed)
        extras = [s for s in all_sessions if s["session_id_short"] not in existing_ids]
        import random as _rng
        _rng.Random(config.indexing.seed + 1).shuffle(extras)
        sessions = sessions + extras[: requested - len(sessions)]

    logger.info(f"Sessions: {len(sessions)}/{requested} (seed={config.indexing.seed})")

    # Count stage-1 cache hits before running (for reporting)
    fp = config.query_gen_fingerprint()
    s1_hits = sum(1 for s in sessions
                  if cache.get(f"{fp}_{cache.make_content_fingerprint(s['body'])}") is not None)

    qg_t0 = time.time()

    stage1_results = run_stage(
        stage="stage1",
        sessions=sessions,
        prompt_fn=partial(build_stage1_prompt, template=stage1_template),
        config=config,
        schema=QUERY_SCHEMA,
        backend=backend,
        cache=cache,
    )

    sessions_s2 = [
        {
            **s,
            "stage1_result": stage1_results[s["session_id_short"]],
            "body": json.dumps(stage1_results[s["session_id_short"]]),
            "original_body": s["body"],
        }
        for s in sessions if s["session_id_short"] in stage1_results
    ]

    # Stage 2 cache hits
    s2_hits = sum(1 for s in sessions_s2
                  if cache.get(f"{fp}_{cache.make_content_fingerprint(s['body'])}") is not None)

    stage2_results = run_stage(
        stage="stage2",
        sessions=sessions_s2,
        prompt_fn=partial(build_stage2_prompt, template=stage2_template),
        config=config,
        schema=QUERY_SCHEMA,
        backend=backend,
        cache=cache,
    )

    qg_duration = round(time.time() - qg_t0, 1)

    # Per-stage cache counts (each session processed twice: stage1 + stage2)
    s1_misses  = len(sessions)    - s1_hits
    s2_misses  = len(sessions_s2) - s2_hits
    cache_hits   = s1_hits + s2_hits
    cache_misses = s1_misses + s2_misses  # = total LLM calls made (2 stages × sessions)

    # Aggregate cost from bronze log
    total_cost = 0.0
    if bronze_path.exists():
        for line in bronze_path.read_text().splitlines():
            try:
                rec = json.loads(line)
                total_cost += rec.get("cost_usd", 0.0)
            except Exception:
                pass

    # Build flat query list
    queries_flat = []
    for session in sessions:
        sid = session["session_id_short"]
        qs = stage2_results.get(sid)
        if qs is None or qs.get("hard", False):
            continue
        for item in qs.get("queries", []):
            queries_flat.append({
                "query":                item["query"],
                "rationale":            item.get("rationale", ""),
                "relevant_session_ids": [sid],
                "session_id_short":     sid,
                "project":              session["project"],
                "date":                 session["date"],
                "style":                item.get("style", ""),
            })

    sessions_generated = len({q["session_id_short"] for q in queries_flat})
    logger.info(f"Query gen: {len(queries_flat)} queries from {sessions_generated} sessions  "
                f"| {cache_hits} hits, {cache_misses} LLM calls (2 stages)  | ${total_cost:.3f}  | {qg_duration}s")

    qg_stats = {
        "sessions_sampled":   len(sessions),
        "sessions_generated": sessions_generated,
        "cache_hits":         cache_hits,
        "cache_misses":       cache_misses,
        "cost_usd":           round(total_cost, 4),
        "duration_s":         qg_duration,
        "backend":            config.query_gen.backend,
        "query_gen_fingerprint": fp,
    }

    if args.generate_only:
        logger.info("--generate-only: stopping before indexing/eval")
        print(f"\nGenerated {len(queries_flat)} queries from {sessions_generated} sessions.")
        print(f"Cache: {cache_hits} hits, {cache_misses} misses. Cost: ${total_cost:.3f}")
        return

    # ── qrec eval: index → serve → eval loop → stop ───────────────────────────
    eval_results = qrec_eval.run(config, queries_flat)

    # ── Write combined results JSON ───────────────────────────────────────────
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    stem      = f"results_{config.run_name}_{timestamp}"
    json_path = RESULTS_DIR / f"{stem}.json"
    html_path = RESULTS_DIR / f"{stem}.html"

    git_hash = get_git_hash()
    output = {
        "meta": {
            "run_name":        config.run_name,
            "experiment":      config.experiment,
            "description":     config.description,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
            "git_hash":        git_hash,
            "run_fingerprint": config.run_fingerprint(),
            "k":               config.eval.k,
            "config":          config.to_dict(),
        },
        "query_gen": qg_stats,
        "indexing":  eval_results["indexing"],
        "eval":      eval_results["eval"],
        "error_analysis": eval_results["error_analysis"],
        "queries":   eval_results["queries"],
    }

    json_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    logger.info(f"Results JSON → {json_path}")

    # ── HTML report ───────────────────────────────────────────────────────────
    report_gen.generate(output, html_path)

    # ── Stdout summary ────────────────────────────────────────────────────────
    print_summary(
        config.run_name,
        qg_stats,
        eval_results["indexing"],
        eval_results["eval"],
        eval_results["error_analysis"],
        config.eval.k,
        json_path,
        html_path,
    )


if __name__ == "__main__":
    main()
