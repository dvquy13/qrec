"""
LLM backend abstraction for the eval pipeline.

AgentBackend  — claude-agent-sdk, concurrent (anyio semaphore), no API key needed
BatchBackend  — Anthropic Batch API, async polling, 50% cheaper, needs ANTHROPIC_API_KEY

Both implement complete_many(sessions, prompt_fn, schema) -> list[tuple[QuerySet, UsageMeta]]
Backends receive only uncached sessions. Cache logic lives in the pipeline.
"""
import time
from typing import Callable, TypedDict

from utils import QuerySet


# Batch API rates (50% off standard: $1.00 input / $5.00 output per 1M for Haiku)
BATCH_RATE_INPUT_PER_1M = 0.50
BATCH_RATE_OUTPUT_PER_1M = 2.50


class UsageMeta(TypedDict):
    input_tokens: int
    output_tokens: int
    cost_usd: float
    backend: str


class AgentBackend:
    """claude-agent-sdk, concurrent via anyio semaphore."""

    # Canonical model name used for cache keys — must match BatchBackend.model
    model = "claude-haiku-4-5-20251001"
    # Short name accepted by the agent SDK CLI
    _sdk_model = "claude-haiku-4-5"

    def __init__(self, concurrency: int = 5):
        self.concurrency = concurrency

    def complete_many(
        self,
        sessions: list[dict],
        prompt_fn: Callable[[dict], str],
        schema: dict,
    ) -> list[tuple[QuerySet, UsageMeta]]:
        import anyio
        from claude_agent_sdk import (
            AssistantMessage,
            ClaudeAgentOptions,
            ResultMessage,
            ToolUseBlock,
        )
        from claude_agent_sdk import query as sdk_query

        results: list[tuple[QuerySet, UsageMeta] | None] = [None] * len(sessions)

        async def process_one(idx: int, session: dict, sem: anyio.Semaphore):
            async with sem:
                options = ClaudeAgentOptions(
                    model=self._sdk_model,
                    max_turns=3,
                    allowed_tools=[],
                    output_format={"type": "json_schema", "schema": schema},
                )
                queryset: QuerySet | None = None
                usage_raw = {}
                async for msg in sdk_query(prompt=prompt_fn(session), options=options):
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if (
                                isinstance(block, ToolUseBlock)
                                and block.name == "StructuredOutput"
                            ):
                                queryset = block.input
                    elif isinstance(msg, ResultMessage):
                        u = msg.usage or {}
                        usage_raw = {
                            "input_tokens": u.get("input_tokens", 0),
                            "output_tokens": u.get("output_tokens", 0),
                            "cost_usd": msg.total_cost_usd or 0.0,
                        }
                if queryset is None:
                    queryset = {"queries": [], "hard": True}
                usage: UsageMeta = {**usage_raw, "backend": "agent"}
                results[idx] = (queryset, usage)

        async def run_all():
            sem = anyio.Semaphore(self.concurrency)
            async with anyio.create_task_group() as tg:
                for idx, session in enumerate(sessions):
                    tg.start_soon(process_one, idx, session, sem)

        anyio.run(run_all)

        # Replace any None (shouldn't happen, but guard)
        return [
            r if r is not None else ({"queries": [], "hard": True}, {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "backend": "agent"})
            for r in results
        ]


class BatchBackend:
    """Anthropic Batch API — async polling, 50% cheaper. Blocks until done."""

    model = "claude-haiku-4-5-20251001"

    def __init__(self, poll_interval: int = 30):
        self.poll_interval = poll_interval

    def complete_many(
        self,
        sessions: list[dict],
        prompt_fn: Callable[[dict], str],
        schema: dict,
    ) -> list[tuple[QuerySet, UsageMeta]]:
        import anthropic
        from dotenv import load_dotenv

        load_dotenv()
        client = anthropic.Anthropic()

        structured_tool = {
            "name": "StructuredOutput",
            "description": "Output the structured result.",
            "input_schema": schema,
        }

        requests = [
            {
                "custom_id": f"{session['session_id_short']}-{idx}",
                "params": {
                    "model": self.model,
                    "max_tokens": 1024,
                    "tools": [structured_tool],
                    "tool_choice": {"type": "tool", "name": "StructuredOutput"},
                    "messages": [{"role": "user", "content": prompt_fn(session)}],
                },
            }
            for idx, session in enumerate(sessions)
        ]

        print(f"Submitting {len(requests)} requests to Batch API...")
        batch = client.messages.batches.create(requests=requests)
        print(f"Batch ID: {batch.id}")

        while True:
            b = client.messages.batches.retrieve(batch.id)
            c = b.request_counts
            print(
                f"  [{b.processing_status}] processing={c.processing} "
                f"succeeded={c.succeeded} errored={c.errored}"
            )
            if b.processing_status == "ended":
                break
            time.sleep(self.poll_interval)

        # Map custom_id (with idx suffix) back to session order
        by_custom_id: dict[str, tuple] = {}
        for result in client.messages.batches.results(batch.id):
            if result.result.type != "succeeded":
                by_custom_id[result.custom_id] = ({"queries": [], "hard": True}, None)
                continue
            msg = result.result.message
            u = msg.usage
            in_tok = u.input_tokens
            out_tok = u.output_tokens
            queryset: QuerySet = {"queries": [], "hard": True}
            for block in msg.content:
                if block.type == "tool_use" and block.name == "StructuredOutput":
                    queryset = block.input
                    break
            cost = (in_tok * BATCH_RATE_INPUT_PER_1M + out_tok * BATCH_RATE_OUTPUT_PER_1M) / 1_000_000
            usage: UsageMeta = {
                "input_tokens": in_tok,
                "output_tokens": out_tok,
                "cost_usd": cost,
                "backend": "batch",
            }
            by_custom_id[result.custom_id] = (queryset, usage)

        empty_usage: UsageMeta = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "backend": "batch"}
        out = []
        for idx, session in enumerate(sessions):
            cid = f"{session['session_id_short']}-{idx}"
            qs, usage = by_custom_id.get(cid, ({"queries": [], "hard": True}, None))
            out.append((qs, usage or empty_usage))
        return out
