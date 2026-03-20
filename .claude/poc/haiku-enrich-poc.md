# PoC: Haiku-based Enrichment via Claude Agent SDK

**Date**: 2026-03-20
**Status**: ✅ Derisked — approach validated, ready to implement

## Problem

Qwen3-1.7B at Q4_K_M quantization produces reliable enrichment on macOS Metal (~95% success)
but degenerates on CUDA (Tesla T4) with ~19% success rate. Root cause: FP16 tensor cores on
Turing-arch GPUs produce flatter logit distributions than Metal's FP32/BF16, causing the model
to fail structured JSON output.

Note: `flashAttention: true` in `model.createContext()` was confirmed to fix Qwen3 enrichment
on the Tesla T4 K8s pod (committed in `39adb92f`). However the Haiku option remains worthwhile
as a zero-GPU fallback (e.g. Linux pods with no GPU at all).

## Approach

Use `@anthropic-ai/claude-agent-sdk` to call Claude Haiku-4.5 for enrichment — no API key
required, uses Claude Code's existing subscription auth.

## Options Evaluated

### Option A — `claude -p` subprocess
```bash
claude -p "prompt..." --model claude-haiku-4-5 --allowedTools ""
```
- ✅ Works, no API key needed
- ❌ Loads Claude Code's full system context (~39k tokens) per call → ~$0.015/session, ~11s
- ❌ `--json-schema` does not force plain JSON output (uses internal tool mechanism)

### Option B — `@anthropic-ai/claude-agent-sdk` with custom `systemPrompt`
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
query({
  prompt: userPrompt,
  options: {
    model: "claude-haiku-4-5",
    tools: [],           // disables ALL built-in tools
    systemPrompt: SYSTEM_PROMPT,  // plain string → REPLACES default CC context
    env: isolatedEnv,
  }
});
```
- ✅ No API key needed
- ✅ `systemPrompt: "..."` (plain string) **replaces** the CC context entirely → ~552 input tokens
- ✅ ~$0.003/session (vs $0.015 for raw `claude -p`)
- ✅ TypeScript-native async iterator, no shell stdout parsing
- ⚠️ ~7s/session (SDK still spawns claude CLI underneath)
- **Chosen approach**

### Option C — `@anthropic-ai/sdk` direct API
- ✅ ~$0.001/session, ~2s/session
- ❌ Requires `ANTHROPIC_API_KEY` — extra setup burden for users

## Authentication

**macOS**: Claude Code stores credentials in macOS Keychain. Auth works in any subprocess as
long as `HOME` and `USER` are in the environment — always true for any process.

**Linux (K8s)**: No keychain. Auth depends on env vars from `~/.zshrc` (e.g. `ANTHROPIC_API_KEY`
or `CLAUDE_CODE_OAUTH_TOKEN`). These propagate through the full spawn chain:
```
shell (sources ~/.zshrc)
  → Claude Code session
    → SessionStart hook
      → qrec daemon (Bun.spawn, inherits env)
        → enrich child (Bun.spawn, inherits daemon env)
```
As long as `claude -p "test"` works in the user's shell, the enrich subprocess chain works too.
`env -i` test (stripping all env vars) failing is expected and irrelevant — that's not how
the daemon spawns children.

**Risk eliminated**: `CLAUDE_CODE_OAUTH_TOKEN` is session-scoped and not required. The SDK/CLI
reads persistent credentials (Keychain on macOS, env vars on Linux) independently.

## Env Isolation Pattern (from claude-mem)

Strip `ANTHROPIC_API_KEY` and `CLAUDECODE` from child env; pass everything else through:
```typescript
const isolatedEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== "ANTHROPIC_API_KEY" && k !== "CLAUDECODE") {
    isolatedEnv[k] = v;
  }
}
```
- `ANTHROPIC_API_KEY` stripped: prevents project `.env` files from hijacking billing
- `CLAUDECODE` stripped: prevents "cannot be launched inside another Claude Code session" error
  (only needed for the Python `claude-agent-sdk`; TypeScript SDK was unaffected in testing)

## Smoke Test Results

```bash
# Basic functionality
CLAUDECODE="" claude -p "Reply with: ok" --model claude-haiku-4-5 --allowedTools ""
# → exit 0, "ok" — PASS

# CLAUDECODE does NOT block the CLI (only blocks Python SDK)
CLAUDECODE="1" claude -p "Reply with: ok" --model claude-haiku-4-5 --allowedTools ""
# → exit 0, "ok" — PASS

# Bun.spawn integration
bun -e "const p = Bun.spawn(['claude','-p','Reply: SMOKE_OK','--model','claude-haiku-4-5','--allowedTools',''], {stdout:'pipe',stderr:'pipe',env:{...process.env,CLAUDECODE:''}}); console.log(await new Response(p.stdout).text())"
# → "SMOKE_OK" — PASS

# Enrichment prompt quality
CLAUDECODE="" claude -p "<system prompt + session digest>" --model claude-haiku-4-5 --allowedTools ""
# → valid JSON with summary/tags/entities/learnings/questions — PASS
# → output has markdown fences (```json...```) but parseResponse() handles this correctly

# SDK with custom systemPrompt (token reduction test)
# → 552 input tokens (vs ~39k with default context) — PASS
# → cost ~$0.003/session — PASS
```

## Token / Cost Breakdown

| Method | cache_create | cache_read | input | output | cost/session |
|--------|-------------|------------|-------|--------|-------------|
| `claude -p` default | 9,133 | 30,361 | 10 | ~500 | ~$0.015 |
| SDK + `systemPrompt` + `tools:[]` | 0 | 0 | 552 | ~300 | ~$0.003 |

For 260 sessions: ~$0.78 total, ~30 min background time.

## Implementation Plan

### New file: `src/summarize-haiku.ts`
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT } from "./prompts/session-extract-v1.ts";
import { buildDigest, parseResponse } from "./summarize.ts";  // export these
import type { SessionSummary } from "./summarize.ts";

export async function summarizeSessionHaiku(chunkText: string): Promise<SessionSummary> {
  const isolatedEnv = buildIsolatedEnv();
  const digest = buildDigest(chunkText);
  const userPrompt = `Transcript:\n\n${digest}\n\nJSON summary:`;

  const queryResult = query({
    prompt: userPrompt,
    options: {
      model: "claude-haiku-4-5",
      tools: [],
      systemPrompt: SYSTEM_PROMPT,
      env: isolatedEnv,
    }
  });

  let text = "";
  for await (const message of queryResult) {
    if (message.type === "assistant") {
      const content = message.message.content;
      if (Array.isArray(content)) {
        text += content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
      }
    }
  }
  return parseResponse(text);
}
```

### `src/config.ts`
- Add `enrichProvider: "haiku" | "local"`, default `"haiku"`
- `QREC_ENRICH_PROVIDER` env var overrides config

### `src/enrich.ts`
- `getEnrichProvider()`: reads `QREC_ENRICH_PROVIDER` → config fallback
- `runEnrich()`: if `haiku`, skip `loadSummarizer()`/`disposeSummarizer()` entirely
- Missing claude binary → log clear error, skip session without marking enriched

### `src/routes.ts`
- `handleSettingsUpdate` accepts `enrichProvider`
- `enrichModel` in `/status` shows actual provider

### `ui/app.js`
- `enrichProvider` dropdown in Configuration section

## Open Questions

1. **`@anthropic-ai/claude-agent-sdk` version**: claude-mem uses `^0.1.76`, latest is `0.2.79`.
   Need to pick a version and check if the `query()` API is stable across them.

2. **Response aggregation**: In the smoke test, `output_tokens: 10` was reported despite a full
   JSON response. The SDK may emit usage across multiple internal messages. Need to handle
   response text concatenation correctly (aggregate all `assistant` message text blocks).

3. **Linux without `claude` installed**: If the user's K8s pod doesn't have Claude Code installed,
   the haiku provider fails at runtime. Should fall back to local gracefully with a clear log
   message rather than leaving sessions unenriched silently.
