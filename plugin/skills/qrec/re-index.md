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

4. To index a single session file:
   ```bash
   qrec index-session ~/.claude/projects/<project>/<session>.jsonl
   ```

5. After indexing, verify:
   ```bash
   qrec status
   curl -s -X POST http://localhost:3030/search \
     -H 'Content-Type: application/json' \
     -d '{"query":"test","k":3}' | jq '.results | length'
   ```

Report the before/after session count to the user.
