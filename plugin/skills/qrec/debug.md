# qrec Debug & Troubleshoot

First, collect diagnostics in one shot:
```bash
qrec status 2>&1 || node $CLAUDE_PLUGIN_ROOT/scripts/bun-runner.js $CLAUDE_PLUGIN_ROOT/scripts/qrec.cjs status 2>&1
tail -30 ~/.qrec/install.log 2>/dev/null || echo "(no install log)"
tail -30 ~/.qrec/qrec.log 2>/dev/null || echo "(no server log)"
curl -s http://localhost:25927/health 2>/dev/null || echo "(health unreachable)"
```

Then match the symptoms below and apply the fix.

---

## Symptom: Claude Code was unresponsive on first session start

**Cause:** Pre-v0.1.2 bug — smart-install ran bun install synchronously in the hook.
**Fix:** Update the plugin to v0.1.2+. After update, first-run install runs in the background.

---

## Symptom: `qrec: command not found`

**Cause:** Background install hasn't run `bun link` yet, or it failed silently.

```bash
# Check if install is still running:
tail -f ~/.qrec/install.log

# Once done (or to force now):
~/.bun/bin/bun link --cwd $CLAUDE_PLUGIN_ROOT

# Or bypass and use full path directly:
node $CLAUDE_PLUGIN_ROOT/scripts/bun-runner.js $CLAUDE_PLUGIN_ROOT/scripts/qrec.cjs status
```

---

## Symptom: `localhost:25927` returns 404 / "Not found"

**Cause:** Pre-v0.1.2 bug — UI files weren't committed to git.
**Fix:** Update the plugin to v0.1.2+.

---

## Symptom: Model load failed — 401 Unauthorized

**Cause:** Pre-v0.1.2 bug — wrong HuggingFace URI used in fallback download.
**Fix:** Update the plugin to v0.1.2+. If still happening after update:
```bash
# Remove partial model file and marker so install re-runs cleanly:
rm -f ~/.qrec/models/embeddinggemma-300M-Q8_0.gguf
rm -f $CLAUDE_PLUGIN_ROOT/.install-version
node $CLAUDE_PLUGIN_ROOT/scripts/smart-install.js
```

---

## Symptom: Search returns 503 / model still loading

**Cause:** Background install is still running (bun install + 300MB model download).
```bash
tail -f ~/.qrec/install.log     # watch progress
```
Once `[bg] Background setup complete` appears in the log, the server retries automatically (every 30s). No restart needed.

If install log shows an error:
```bash
# Re-trigger background install manually:
rm -f $CLAUDE_PLUGIN_ROOT/.install-version
node $CLAUDE_PLUGIN_ROOT/scripts/smart-install.js
```

---

## Symptom: Sessions: 0 / search returns no results

**Cause:** Initial index didn't run (background install failed or was interrupted).
```bash
qrec index ~/.claude/projects/
```
This re-indexes everything. Takes a few minutes depending on session count.

---

## Symptom: Daemon not running (no PID / health unreachable)

```bash
qrec serve --daemon
curl -s http://localhost:25927/health
```
If it crashes immediately, check `~/.qrec/qrec.log` for the error.

---

## Symptom: `bun install` fails (native module error)

node-llama-cpp or sqlite-vec failed to install.
```bash
bun install --cwd $CLAUDE_PLUGIN_ROOT
```
If it fails, check for disk space and that the machine has internet access to npm registry.

---

## Symptom: Permission denied on `~/.qrec/`

```bash
ls -la ~/.qrec/
chmod -R u+rw ~/.qrec/
```

---

## Still stuck?

Run this and share the output:
```bash
echo "=== versions ===" && node --version && ~/.bun/bin/bun --version 2>/dev/null || echo "bun not found"
echo "=== plugin root ===" && echo $CLAUDE_PLUGIN_ROOT
echo "=== install log ===" && cat ~/.qrec/install.log 2>/dev/null
echo "=== server log ===" && cat ~/.qrec/qrec.log 2>/dev/null
```
