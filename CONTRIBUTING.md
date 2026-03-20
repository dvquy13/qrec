# Contributing to qrec

Thank you for your interest in contributing! This document covers how to get set up locally, run tests, and submit a pull request.

## Prerequisites

- [Bun](https://bun.sh) v1.1.0+
- macOS or Linux (Windows is not supported)
- Node.js v18+ (for the CLI wrapper bootstrap)
- NVIDIA GPU optional but recommended on Linux for enrichment features

## Local setup

```bash
git clone https://github.com/dvquy13/qrec.git
cd qrec
bun install
bun link          # symlinks ~/.bun/bin/qrec → src/cli.ts for dev
```

Verify it works:

```bash
qrec --version    # shows "(dev)" in dev mode — expected
QREC_EMBED_PROVIDER=stub qrec serve --daemon
qrec status
qrec stop
```

## Running tests

Always use `QREC_EMBED_PROVIDER=stub` — it skips the embedding model download and keeps tests fast.

```bash
QREC_EMBED_PROVIDER=stub bun test
```

To run a specific test file:

```bash
QREC_EMBED_PROVIDER=stub bun test test/search.test.ts
```

## Building the distributable

```bash
node scripts/build.js       # compiles src/cli.ts → plugin/scripts/qrec.cjs
bash scripts/smoke-test.sh  # full build + artifact smoke test
```

## Project structure

```
src/          TypeScript source (Bun runtime)
test/         Unit + integration tests
ui/           Browser SPA (plain JS/CSS, no build step)
plugin/       Claude Code plugin manifest, hooks, and skills
scripts/      Build, release, and test scripts
eval/         Eval pipeline (Python, run with uv)
docs/         Architecture and design notes
```

See [CLAUDE.md](CLAUDE.md) for a full codebase map with file-by-file descriptions.

## Making changes

- **Source code** lives in `src/`. The entry point is `src/cli.ts`.
- **UI** lives in `ui/`. Edit and reload the browser — no daemon restart needed.
- **Tests** are in `test/`. Add a test for any new behavior.
- **Docs** live in `docs/ARCHITECTURE.md`. Update if you change the search pipeline or schema.

## Commit style

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(search): add date-range filter to BM25 query
fix(indexer): skip empty JSONL files gracefully
docs: update prerequisites for Linux CUDA
chore: bump node-llama-cpp to 3.17.2
```

PR titles are validated against this format by CI.

## Submitting a PR

1. Fork the repo and create a branch from `main`.
2. Make your changes with tests.
3. Run `QREC_EMBED_PROVIDER=stub bun test` — all tests must pass.
4. Open a PR with a conventional commit title.
5. CI will run tests on both macOS and Linux.

## Reporting bugs

Open an issue at [github.com/dvquy13/qrec/issues](https://github.com/dvquy13/qrec/issues). Include:
- Your OS and Bun version (`bun --version`)
- The output of `qrec status`
- Steps to reproduce
