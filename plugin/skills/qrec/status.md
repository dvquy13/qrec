# qrec Status Check

1. Run status command and capture output:
   ```bash
   qrec status
   ```
   If `qrec` not in PATH: `node $CLAUDE_PLUGIN_ROOT/scripts/bun-runner.js $CLAUDE_PLUGIN_ROOT/scripts/qrec.cjs status`

2. Show the output to the user, then interpret:
   - **Daemon PID**: process is running
   - **HTTP health: ok** → server up; anything else → daemon crashed or not started
   - **Sessions / Chunks = 0** → not indexed yet (first-run install may still be in progress)
   - **Last indexed: never** → no sessions indexed; suggest `qrec index`
   - **Model state in /health response** → `loading` = background install in progress, `error` = load failed

3. Check install progress if first-run may be ongoing:
   ```bash
   tail -20 ~/.qrec/install.log
   ```

4. Report a clear summary: what's working, what isn't, and the next step if anything needs fixing.
   Link to debug.md steps if there's an active error.
