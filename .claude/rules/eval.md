---
paths:
  - eval/**
---

# Eval Pipeline Rules

## Running the pipeline

Always use `--config` with a YAML file. The config embeds all params; results are reproducible.

```bash
# Full pipeline: query gen → index → serve → eval → JSON + HTML report
bash scripts/reset.sh   # wipe DB for a clean run (keeps query gen cache)
CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml

# Query gen only (no indexing/eval)
CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml --generate-only

# CLI overrides (take precedence over config)
CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/... --sessions 10 --seed 7
```

## AgentBackend inside Claude Code

`AgentBackend` launches `claude-agent-sdk` which is blocked when `CLAUDECODE` env var is set.
**Always prefix with `CLAUDECODE=""`** when running from a Claude Code session.
Not needed for `--backend batch` (uses Anthropic API directly), but prefix anyway for safety.

## Backend selection

**Use `--backend batch` for any run ≥ 10 sessions.** Config YAML default is `batch`.

Agent backend: fast feedback, no API key, concurrent — for quick 2–5 session tests only.
Batch backend: 50% cheaper (~$0.005/session), ~2–3 min per batch job, needs `ANTHROPIC_API_KEY` in `.env`.

## Cache key design

```
query_gen_fingerprint = hash(model + stage1_prompt + stage2_prompt + schema_json)
cache_key = f"{query_gen_fingerprint}_{sha256(session_body)}"
```

**Included** in fingerprint: model, prompt content, output schema (QUERY_SCHEMA).
**Excluded**: seed, sessions count, backend, indexing strategy — these affect sampling, not per-session output.

Schema changes (`QUERY_SCHEMA` in `generate_queries.py`) MUST be registered via `config.set_schema(QUERY_SCHEMA)` in `pipeline.py` — otherwise schema changes don't invalidate cache.

Silver cache: `eval/cache/cache.json` — persists across runs, never wiped by `reset.sh`.
Bronze log: `eval/logs/runs/{run_id}/responses.jsonl` — per-run audit trail.

## Results format

`eval/data/results/results_{run_name}_{timestamp}.json` + `.html`

JSON contains: `meta` (config snapshot, git hash, run fingerprint), `query_gen` (cache hits, LLM calls, cost, duration), `indexing` (sessions, chunks, duration), `eval` (Found@10, NDCG@10, latency, RSS), `error_analysis` (grouped misses with diagnosis + hypothesis), `queries` (per-query detail with `rank_of_relevant`).

## QUERY_SCHEMA

Style field is required: `full-question | keyword-soup | action-phrase | short-concept`.
Changing the schema without calling `config.set_schema()` in `pipeline.py` silently reuses stale cached results — the schema would be applied as a tool constraint but cached outputs won't have the new field.
