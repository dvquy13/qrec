"""
qrec eval module: index sessions → start daemon → HTTP eval loop → metrics → stop daemon.
Called by pipeline.py after query generation. Returns a structured result dict.
"""
import json
import math
import re
import sqlite3
import subprocess
import time
import urllib.request
from pathlib import Path
from typing import Optional

# ── Constants ──────────────────────────────────────────────────────────────────

PID_FILE = Path.home() / ".qrec" / "qrec.pid"
DB_PATH  = Path.home() / ".qrec" / "qrec.db"
SRC_CLI  = Path(__file__).parent.parent / "src" / "cli.ts"

# ── System helpers ─────────────────────────────────────────────────────────────

def get_rss_kb(pid: int) -> int:
    try:
        r = subprocess.run(["ps", "-o", "rss=", "-p", str(pid)],
                           capture_output=True, text=True)
        return int(r.stdout.strip()) if r.returncode == 0 else 0
    except Exception:
        return 0


def get_daemon_pid() -> Optional[int]:
    try:
        return int(PID_FILE.read_text().strip()) if PID_FILE.exists() else None
    except ValueError:
        return None


def get_chunk_counts() -> dict:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        rows = conn.execute(
            "SELECT session_id, COUNT(*) FROM chunks GROUP BY session_id"
        ).fetchall()
        conn.close()
        return {r[0]: r[1] for r in rows}
    except Exception:
        return {}


def get_db_counts() -> tuple:
    try:
        conn = sqlite3.connect(str(DB_PATH))
        s = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        c = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        conn.close()
        return s, c
    except Exception:
        return 0, 0

# ── Index ──────────────────────────────────────────────────────────────────────

def run_indexer(sessions: int, seed: int, vault: Path) -> dict:
    cmd = ["bun", "run", str(SRC_CLI), "index", str(vault),
           "--sessions", str(sessions), "--seed", str(seed)]
    print(f"[qrec_eval] Indexing: {' '.join(cmd)}")
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    duration_s = round(time.time() - t0, 1)

    output = proc.stdout + proc.stderr
    if proc.returncode not in (0, 143):
        raise RuntimeError(f"Indexer failed (exit {proc.returncode}):\n{output[-2000:]}")

    sessions_indexed = 0
    for line in output.splitlines():
        m = re.search(r"Total sessions indexed: (\d+)", line)
        if m:
            sessions_indexed = int(m.group(1))

    sessions_in_db, chunks_in_db = get_db_counts()
    print(f"[qrec_eval] Indexed {sessions_indexed} sessions in {duration_s}s "
          f"(DB: {sessions_in_db} sessions, {chunks_in_db} chunks)")
    return {
        "sessions_indexed": sessions_indexed,
        "sessions_in_db": sessions_in_db,
        "chunks_in_db": chunks_in_db,
        "duration_s": duration_s,
    }

# ── Daemon ─────────────────────────────────────────────────────────────────────

def start_daemon(server_url: str) -> int:
    cmd = ["bun", "run", str(SRC_CLI), "serve", "--daemon"]
    subprocess.run(cmd, capture_output=True)
    deadline = time.time() + 45
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{server_url}/health", timeout=1)
            pid = get_daemon_pid()
            print(f"[qrec_eval] Daemon ready (PID {pid})")
            return pid or 0
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("Daemon failed to start within 45 seconds")


def stop_daemon():
    cmd = ["bun", "run", str(SRC_CLI), "stop"]
    subprocess.run(cmd, capture_output=True)
    print("[qrec_eval] Daemon stopped")

# ── Metrics ────────────────────────────────────────────────────────────────────

def found_at_k(retrieved: list, relevant: set, k: int) -> bool:
    return any(r in relevant for r in retrieved[:k])

def ndcg_at_k(retrieved: list, relevant: set, k: int) -> float:
    dcg  = sum(1 / math.log2(i + 2) for i, r in enumerate(retrieved[:k]) if r in relevant)
    idcg = sum(1 / math.log2(i + 2) for i in range(min(len(relevant), k)))
    return dcg / idcg if idcg > 0 else 0.0

def percentile(values: list, p: int) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = (p / 100) * (len(s) - 1)
    lo, hi = int(idx), min(int(idx) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)

# ── Error analysis ─────────────────────────────────────────────────────────────

HYPOTHESES = {
    "COMPETING_SESSIONS": (
        "Relevant session outscored by a larger session covering similar topics. "
        "Doc enrichment (Phase 2) may improve signal density for short sessions."
    ),
    "RANKED_LOW": (
        "Relevant session is retrievable (in top-50) but falls outside top-k. "
        "Tuning RRF k constant or widening the candidate pool may help."
    ),
    "NOT_RETRIEVED": (
        "Relevant session absent from top-50. Likely a lexical gap or embedding mismatch. "
        "Consider doc enrichment or larger candidate pool."
    ),
}

def diagnose(q: dict, chunk_counts: dict, k: int) -> str:
    rank = q.get("rank_of_relevant")
    if rank is not None and rank <= k:
        return "OK"
    if rank is None:
        return "NOT_RETRIEVED"
    top_id = q["retrieved_ids"][0] if q["retrieved_ids"] else None
    relevant_chunks = chunk_counts.get(q["session_id"], 0)
    top_chunks = chunk_counts.get(top_id, 0) if top_id else 0
    if relevant_chunks > 0 and top_chunks >= 2 * relevant_chunks:
        return "COMPETING_SESSIONS"
    return "RANKED_LOW"

def run_error_analysis(query_results: list, chunk_counts: dict, k: int) -> dict:
    missed = [q for q in query_results if not q["found"]]
    groups: dict = {}
    for q in missed:
        diag = diagnose(q, chunk_counts, k)
        q["diagnosis"] = diag
        groups.setdefault(diag, []).append(q)

    return {
        "total_missed": len(missed),
        "groups": {
            diag: {
                "count": len(qs),
                "hypothesis": HYPOTHESES.get(diag, ""),
                "queries": qs,
            }
            for diag, qs in sorted(groups.items(), key=lambda x: -len(x[1]))
        },
    }

# ── HTTP eval loop ─────────────────────────────────────────────────────────────

def run_eval_loop(queries: list, k: int, server_url: str) -> list:
    FETCH_K = max(50, k)
    results = []
    for i, item in enumerate(queries):
        relevant = set(item["relevant_session_ids"])
        t0 = time.time()
        retrieved_ids = []
        try:
            req = urllib.request.Request(
                f"{server_url}/search",
                data=json.dumps({"query": item["query"], "k": FETCH_K}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            retrieved_ids = [r["session_id"] for r in data.get("results", [])]
        except Exception as e:
            print(f"[qrec_eval] Query {i+1} error: {e}")

        latency_ms = round((time.time() - t0) * 1000, 1)

        rank_of_relevant = next(
            (rank for rank, sid in enumerate(retrieved_ids, 1) if sid in relevant),
            None
        )

        results.append({
            "query":             item["query"],
            "session_id":        item["session_id_short"],
            "style":             item.get("style", ""),
            "found":             found_at_k(retrieved_ids, relevant, k),
            "rank_of_relevant":  rank_of_relevant,
            "ndcg":              round(ndcg_at_k(retrieved_ids, relevant, k), 4),
            "retrieved_ids":     retrieved_ids[:k],
            "latency_ms":        latency_ms,
            "k":                 k,
        })

        if (i + 1) % 10 == 0 or i == len(queries) - 1:
            f10   = sum(r["found"] for r in results) / len(results)
            ndcg_ = sum(r["ndcg"]  for r in results) / len(results)
            print(f"  [{i+1}/{len(queries)}] Found@{k}={f10*100:.1f}%  NDCG@{k}={ndcg_:.3f}")

    return results

# ── Main entry point ───────────────────────────────────────────────────────────

def run(config, queries: list) -> dict:
    """
    Full qrec eval pipeline:
      index → start daemon → eval loop → error analysis → stop daemon → return results
    """
    from pathlib import Path as P
    k          = config.eval.k
    server_url = config.eval.server_url
    vault      = P(config.indexing.vault).expanduser()

    # 1. Index
    indexing_stats = run_indexer(config.indexing.sessions, config.indexing.seed, vault)

    # 2. Start daemon
    we_started = get_daemon_pid() is None
    if we_started:
        daemon_pid = start_daemon(server_url)
    else:
        daemon_pid = get_daemon_pid() or 0
        print(f"[qrec_eval] Reusing running daemon (PID {daemon_pid})")

    startup_rss_kb = get_rss_kb(daemon_pid)
    print(f"[qrec_eval] Startup RSS: {startup_rss_kb // 1024} MB")

    # 3. Filter queries to indexed sessions
    with urllib.request.urlopen(f"{server_url}/sessions", timeout=5) as resp:
        indexed_ids = set(json.loads(resp.read())["sessions"])

    eval_queries = [q for q in queries if q["session_id_short"] in indexed_ids]
    covered_sessions = len({q["session_id_short"] for q in eval_queries})
    print(f"[qrec_eval] Coverage: {len(eval_queries)}/{len(queries)} queries, "
          f"{covered_sessions} sessions\n")

    if not eval_queries:
        if we_started:
            stop_daemon()
        raise RuntimeError("No eval queries match indexed sessions. Index more sessions.")

    # 4. Eval loop
    query_results = run_eval_loop(eval_queries, k, server_url)

    # 5. Post-eval RSS
    post_eval_rss_kb = get_rss_kb(daemon_pid)

    # 6. Stop daemon
    if we_started:
        stop_daemon()

    # 7. Aggregate metrics
    latencies  = [r["latency_ms"] for r in query_results]
    found_vals = [r["found"] for r in query_results]
    ndcg_vals  = [r["ndcg"]  for r in query_results]

    eval_summary = {
        "queries_run":       len(query_results),
        "sessions_covered":  covered_sessions,
        "found_at_k":        round(sum(found_vals) / len(found_vals), 4),
        "ndcg_at_k":         round(sum(ndcg_vals)  / len(ndcg_vals),  4),
        "latency_p50_ms":    round(percentile(latencies, 50), 1),
        "latency_p95_ms":    round(percentile(latencies, 95), 1),
        "rss_startup_kb":    startup_rss_kb,
        "rss_post_eval_kb":  post_eval_rss_kb,
    }

    # 8. Error analysis
    chunk_counts = get_chunk_counts()
    error_report = run_error_analysis(query_results, chunk_counts, k)

    return {
        "indexing":       indexing_stats,
        "eval":           eval_summary,
        "error_analysis": error_report,
        "queries":        query_results,
    }
