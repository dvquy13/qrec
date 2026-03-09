import hashlib
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path


@dataclass
class QueryGenConfig:
    model: str = "claude-haiku-4-5-20251001"
    prompt_version: str = "v2"
    backend: str = "batch"
    min_body_chars: int = 800


@dataclass
class IndexingConfig:
    strategy: str = "raw"
    sessions: int = 30
    seed: int = 42
    vault: str = "~/vault/sessions"


@dataclass
class EvalConfig:
    k: int = 10
    server_url: str = "http://localhost:3030"


@dataclass
class RunConfig:
    run_name: str = "unnamed"
    experiment: str = "default"
    description: str = ""
    query_gen: QueryGenConfig = field(default_factory=QueryGenConfig)
    indexing: IndexingConfig = field(default_factory=IndexingConfig)
    eval: EvalConfig = field(default_factory=EvalConfig)

    # Set by pipeline after loading prompt files and schema — not part of YAML
    _stage1_prompt: str = field(default="", repr=False)
    _stage2_prompt: str = field(default="", repr=False)
    _schema_json: str = field(default="", repr=False)

    def set_prompts(self, stage1: str, stage2: str):
        self._stage1_prompt = stage1
        self._stage2_prompt = stage2

    def set_schema(self, schema: dict):
        """Include output schema in fingerprint so schema changes invalidate the cache."""
        self._schema_json = json.dumps(schema, sort_keys=True)

    def query_gen_fingerprint(self) -> str:
        """Cache key component: only what affects per-session query output.
        Seed/sessions/strategy excluded — they affect sampling, not per-session output.
        Schema IS included — changing the output schema must invalidate cached results."""
        raw = f"{self.query_gen.model}\x00{self._stage1_prompt}\x00{self._stage2_prompt}\x00{self._schema_json}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def fingerprint(self) -> str:
        """Backward-compat alias used by pipeline.py and run_stage."""
        return self.query_gen_fingerprint()

    def run_fingerprint(self) -> str:
        """Full run identity — stored in results JSON for reproducibility."""
        d = {
            "run_name": self.run_name,
            "query_gen": asdict(self.query_gen),
            "indexing": asdict(self.indexing),
            "eval": asdict(self.eval),
            "stage1_prompt": self._stage1_prompt,
            "stage2_prompt": self._stage2_prompt,
        }
        return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "run_name": self.run_name,
            "experiment": self.experiment,
            "description": self.description,
            "query_gen": asdict(self.query_gen),
            "indexing": asdict(self.indexing),
            "eval": asdict(self.eval),
        }

    # Backward-compat properties used by pipeline.py
    @property
    def model(self) -> str:
        return self.query_gen.model

    @property
    def stage1_prompt(self) -> str:
        return self._stage1_prompt

    @property
    def stage2_prompt(self) -> str:
        return self._stage2_prompt

    @classmethod
    def from_yaml(cls, path: Path) -> "RunConfig":
        import yaml
        data = yaml.safe_load(path.read_text())
        def pick(d: dict, cls_) -> dict:
            return {k: v for k, v in d.items() if k in cls_.__dataclass_fields__}
        return cls(
            run_name=data.get("run_name", path.stem),
            experiment=data.get("experiment", "default"),
            description=data.get("description", ""),
            query_gen=QueryGenConfig(**pick(data.get("query_gen", {}), QueryGenConfig)),
            indexing=IndexingConfig(**pick(data.get("indexing", {}), IndexingConfig)),
            eval=EvalConfig(**pick(data.get("eval", {}), EvalConfig)),
        )
