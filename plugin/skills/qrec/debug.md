# qrec Debug & Troubleshoot

First, collect diagnostics in one shot:
```bash
qrec status 2>&1 || node $CLAUDE_PLUGIN_ROOT/scripts/qrec-cli.js status 2>&1
tail -30 ~/.qrec/qrec.log 2>/dev/null || echo "(no server log)"
curl -s http://localhost:25927/health 2>/dev/null || echo "(health unreachable)"
```

Then match the symptoms below and apply the fix.

---

## Symptom: `qrec: command not found`

**Cause:** qrec not linked globally yet (fresh install or bun link not run).

```bash
# Install and link:
cd $CLAUDE_PLUGIN_ROOT && bun install && bun link

# Or use the full path directly:
node $CLAUDE_PLUGIN_ROOT/scripts/qrec-cli.js status
```

---

## Symptom: Search returns 503 / model still loading

**Cause:** Model is still downloading or loading in the background (normal on first run).
```bash
tail -f ~/.qrec/qrec.log     # watch progress
```
Wait for model to finish loading — search will work automatically once ready. No restart needed.

If the log shows a download error:
```bash
# Remove partial model and restart daemon:
rm -f ~/.qrec/models/embeddinggemma-300M-Q8_0.gguf
qrec stop
qrec serve --daemon
```

---

## Symptom: Sessions: 0 / search returns no results

**Cause:** Index hasn't run yet or was interrupted.
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

## Symptom: Model load failed — 401 Unauthorized

**Cause:** HuggingFace download failed (network issue or wrong URI).
```bash
# Remove partial model file and restart:
rm -f ~/.qrec/models/embeddinggemma-300M-Q8_0.gguf
qrec stop
qrec serve --daemon
tail -f ~/.qrec/qrec.log
```

---

## Symptom: `bun install` fails (native module error)

node-llama-cpp or sqlite-vec failed to install.
```bash
bun install --cwd $CLAUDE_PLUGIN_ROOT
```
If it fails, check for disk space and internet access to npm registry.

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
echo "=== server log ===" && cat ~/.qrec/qrec.log 2>/dev/null
```
