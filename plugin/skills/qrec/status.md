# qrec Status Check

1. Run status command and capture output:
   ```bash
   qrec status
   ```
   If `qrec` not in PATH: `node $CLAUDE_PLUGIN_ROOT/scripts/qrec-cli.js status`

2. Show the output to the user, then interpret:
   - **Daemon PID**: process is running
   - **HTTP health: ok** → server up; anything else → daemon crashed or not started
   - **Sessions / Chunks = 0** → not indexed yet (model may still be loading on first run)
   - **Last indexed: never** → no sessions indexed; suggest `qrec index`
   - **Model state in /health response** → `loading` = model loading in background, `error` = load failed

3. If daemon seems unresponsive, check the server log:
   ```bash
   tail -20 ~/.qrec/qrec.log
   ```

4. Report a clear summary: what's working, what isn't, and the next step if anything needs fixing.
   Link to debug.md steps if there's an active error.
