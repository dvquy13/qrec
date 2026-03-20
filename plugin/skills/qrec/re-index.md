# qrec Re-index Sessions

Use when: sessions aren't showing up in search, DB was reset, or you want to re-import all history.

1. Check current state:
   ```bash
   qrec status
   ```

2. Index all sessions (default path `~/.claude/projects/`):
   ```bash
   qrec index
   ```
   Or a specific path:
   ```bash
   qrec index ~/.claude/projects/
   ```
   This is safe to re-run — already-indexed sessions are skipped unless `--force` is passed.

3. To force re-index everything from scratch:
   ```bash
   qrec index --force
   ```
   Note: `--force` preserves enriched titles/summaries for sessions whose content hasn't changed.
   If enriched titles were lost (e.g. after a re-index on an older version), recover them with:
   ```bash
   qrec enrich --force
   ```

4. After indexing, verify:
   ```bash
   qrec status
   curl -s -X POST http://localhost:25927/search \
     -H 'Content-Type: application/json' \
     -d '{"query":"test","k":3}' | jq '.results | length'
   ```

Note: the daemon also auto-indexes every 60 seconds. New sessions from the current Claude Code session will appear automatically without manual re-indexing.

Report the before/after session count to the user.
