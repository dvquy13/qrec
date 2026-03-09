Check qrec engine health and diagnose issues.

Steps:
1. Call the `status()` MCP tool from the qrec server
2. Read `~/.qrec/install.log` (last 50 lines) for installation history
3. Report: health status, session_count, chunk_count, last_indexed, model_loaded, daemon_pid
4. If health != "ok": identify root cause from log_tail and suggest fix

Common fixes:
- Model not loaded: `bun run /path/to/qrec/src/cli.ts serve --daemon`
- DB empty: `bun run /path/to/qrec/src/cli.ts index ~/vault/sessions`
- Bun missing: re-run `node $CLAUDE_PLUGIN_ROOT/scripts/smart-install.js`
- Permission error: check `~/.qrec/` directory permissions
