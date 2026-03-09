"""
Bronze/silver response cache for eval pipeline.

Bronze (per-run): eval/logs/runs/{run_id}/responses.jsonl
  - Append-only audit trail for a single run
  - Never touched after the run completes

Silver (persistent): eval/cache/cache.json
  - Deduped lookup dict {hash: record}
  - Loaded into memory at startup, atomically rewritten on each new entry
  - Can be rebuilt from all bronze files if corrupted
"""
import hashlib
import json
from pathlib import Path
from typing import Optional

from utils import QuerySet


SILVER_PATH = Path("eval/cache/cache.json")


class ResponseCache:
    def __init__(self, run_bronze: Path):
        self._bronze = run_bronze
        self._store: dict[str, dict] = {}
        if SILVER_PATH.exists():
            try:
                self._store = json.loads(SILVER_PATH.read_text())
            except (json.JSONDecodeError, OSError):
                self._store = {}

    @staticmethod
    def make_content_fingerprint(content: str) -> str:
        """sha256(content)[:16]. Combine with RunConfig.fingerprint() at call site."""
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def get(self, key: str) -> Optional[QuerySet]:
        record = self._store.get(key)
        if record is None:
            return None
        return record["result"]

    def put(self, key: str, result: QuerySet, **meta):
        """
        meta must include: session_id, stage, model, cost_usd, timestamp
        """
        record = {"hash": key, "result": result, **meta}
        # 1. Append to bronze (audit trail for this run)
        self._bronze.parent.mkdir(parents=True, exist_ok=True)
        with self._bronze.open("a") as f:
            f.write(json.dumps(record) + "\n")
        # 2. Update silver with full record (atomic temp+rename)
        self._store[key] = record
        SILVER_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = SILVER_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._store))
        tmp.rename(SILVER_PATH)

    def sessions_processed(self, stage: str) -> set[str]:
        """Return session_ids that have a cached result for the given stage."""
        return {v["session_id"] for v in self._store.values() if v.get("stage") == stage}
