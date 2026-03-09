# Phase 5 — CI/CD: Open Issues & Learnings

_Created: 2026-03-09. Track blockers from the first CI push._

---

## Status

| Issue | Severity | Status |
|---|---|---|
| CI: model download fails (HF 401 + cache ordering) | Blocker | Fixed — stub embed provider; `indexer.ts` now uses `getEmbedProvider()` |
| CI: `bun install` times out on macos-latest | Blocker | Fixed — `node_modules` cache + `timeout-minutes: 30` |
| Release: `npm run release` auth failure with `gho_` token | Medium | Fixed — replaced with `scripts/release.sh` |
| Large binary in `docs/ext/claude-mem` (60MB) | Low | Fixed — `docs/ext/` untracked + gitignored |

---

## Issue 1 — CI: Embedding model not available (HuggingFace 401)

**Symptom** (ubuntu-latest, run 22859515345):
```
[embed] Model not found locally. Downloading hf_ggml-org_embeddinggemma-300M-Q8_0.gguf...
error: Failed to fetch manifest for "hf:ggml-org/embeddinggemma-300M-Q8_0": 401 Unauthorized
```

**Root causes:**
1. The `Cache embedding model` step is placed *after* `Install dependencies` — so on a cold cache it tries to download before the cache is restored. Cache action must come *before* the index step.
2. HuggingFace model download requires a `HF_TOKEN` for gated or rate-limited models — CI runners have no credentials by default.
3. Even with correct cache ordering, the first run always misses (cold start). Need HF_TOKEN or a different strategy.

**Fix options (pick one):**
- **Option A (simplest):** Skip local embeddings in CI entirely. Set `QREC_EMBED_PROVIDER=ollama` with a pre-seeded mock, or use a stub that returns zero vectors for CI index tests. CI verifies parsing + storage, not embedding quality.
- **Option B:** Add `HF_TOKEN` as a GitHub Actions secret, pass it to the download step. Still slow on first run (~500MB download).
- **Option C:** Pre-download the model and store in a GitHub release asset, download with `gh release download` in CI.

**Recommended: Option A** — CI should test the search pipeline, not the embedding model. Move embedding concern out of CI.

**Workflow change needed:**
```yaml
# Move cache step before dependencies, and add HF_TOKEN
- name: Cache embedding model
  uses: actions/cache@v4
  with:
    path: ~/.cache/qmd/models
    key: qrec-model-embeddinggemma-300M-Q8_0

- name: Install dependencies
  run: bun install

# For index test, set embed provider to avoid model load:
- name: Integration test — index fixtures
  env:
    QREC_EMBED_PROVIDER: ollama   # or a stub provider
  run: |
    bun run src/cli.ts index eval/fixtures/sessions/
```

---

## Issue 2 — CI: `bun install` times out on macos-latest

**Symptom** (macos-latest, run 22859515345):
```
Install dependencies  →  ##[error]The operation was canceled.
```

**Root cause:** `node-llama-cpp` downloads large platform-specific native binaries during `bun install`. On macos-latest this likely hit a timeout or runner disk/network limit. The `bun install` step has no explicit timeout in the workflow.

**Fix options:**
- Add `timeout-minutes: 30` to the job or the install step.
- Pin `bun install --frozen-lockfile` and cache `node_modules` to avoid re-downloading binaries.

**Workflow change needed:**
```yaml
jobs:
  ci:
    timeout-minutes: 30    # add job-level timeout
    ...
    - name: Cache node_modules
      uses: actions/cache@v4
      with:
        path: node_modules
        key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}

    - name: Install dependencies
      run: bun install --frozen-lockfile
```

---

## Issue 3 — Release: `npm run release` fails with `gho_` OAuth token — FIXED

**Symptom:**
```
ERROR Could not authenticate with GitHub using environment variable "GITHUB_TOKEN".
```

**Root cause:** release-it's GitHub plugin calls `octokit.users.getAuthenticated()` and checks `X-OAuth-Scopes` header. The `gho_` token from `gh auth token` is an OAuth app token — it doesn't always return this header, so release-it's auth check fails even though the token has valid `repo` scope.

**Confirmed working:** Classic PAT (`ghp_`) with `repo` scope does return `X-OAuth-Scopes: repo`. But token must be parsed from `.env` explicitly — `source .env` does not override an already-set shell variable.

**Loading `.env` correctly in shell:**
```bash
# Does NOT work reliably (doesn't override existing env var):
source .env && npm run release

# Works — parse with python3:
export GITHUB_TOKEN=$(python3 -c "
for line in open('.env'):
    if line.startswith('GITHUB_TOKEN='):
        print(line.split('=',1)[1].strip())
        break
") && npm run release -- 0.1.0
```

**Fix applied:** Replaced release-it with `scripts/release.sh`. Removed `release-it` and `@release-it/conventional-changelog` from devDependencies. Updated `npm run release` → `bash scripts/release.sh`.

**New release flow:**
```bash
npm run release 0.2.0
# or directly:
bash scripts/release.sh 0.2.0
```

Script does: semver validation → clean tree check → sync versions → build artifact → generate CHANGELOG → commit → tag → push → `gh release create` with CHANGELOG notes. Uses `gh auth` (no separate token config).

---

## Issue 4 — Large binary in `docs/ext/claude-mem` (60MB) — FIXED

**Root cause:** `docs/ext/` subtrees (qmd, claude-mem) were swept into git during the `git add -A` orphan squash. These are local-only references — not for distribution. The `claude-mem` subtree shipped a 60MB compiled binary.

**Fix applied:** Added `docs/ext/` to `.gitignore`, ran `git rm -r --cached docs/ext/` to untrack 718 files. Committed and pushed. Warning gone on future pushes.

---

## Learnings

### `.gitignore` scope matters
`*.html` was too broad — it gitignored `ui/search.html` and `ui/audit.html` which are source files needed by the build. Changed to `eval/**/*.html` to only exclude generated eval reports. Always scope gitignore patterns to the specific directory.

### CI cache ordering is critical
`actions/cache@v4` must be placed **before** the step that needs the cached artifact. Placing it after means: cache lookup happens after the artifact is already needed → cold miss → download attempt → failure.

### Synthetic JSONL fixtures are better than real sessions
Real session files contain personal info (`/Users/<username>` paths, conversation content). Synthetic fixtures are:
- Safe to commit publicly
- Purpose-built for the tests (contain keywords CI will search for)
- Easier to control (known structure, known content)

### release-it token requirements
release-it requires a classic PAT (`ghp_`) — not the OAuth token from `gh auth token` (`gho_`). The `gho_` token works for `git push` and `gh` CLI but not for release-it's scope validation.

### `source .env` in subshells
`source .env` won't override a variable that's already exported in the parent shell. Parse explicitly with `python3` when you need a guaranteed fresh value from `.env`.

---

## Next Actions for Phase 5 completion

```
[ ] Fix CI: decide on Option A (skip local embeddings) or Option B (HF_TOKEN secret)
[ ] Fix CI: add node_modules cache + job-level timeout for macos-latest bun install
[ ] Move cache step before dependencies in ci.yml
[ ] Decide on release-it auth: skipChecks vs classic PAT workflow
[ ] Create v0.1.0 tag + GitHub release (manually or via release-it once auth is fixed)
[ ] Verify CI passes on both ubuntu-latest and macos-latest
```

### Phase 5 exit gate (from plan)
```
[ ] CI passes on ubuntu-latest and macos-latest
[ ] Model cache hits on second run (< 30s for model step)
[ ] PR title workflow enforces Conventional Commits
[ ] npm run release dry run completes without error
```
