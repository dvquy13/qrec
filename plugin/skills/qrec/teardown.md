# qrec Teardown

1. Stop the daemon:
   ```bash
   qrec stop
   ```

2. Remove the plugin from Claude Code:
   ```bash
   claude plugin remove dvquy13-qrec
   ```
   Or remove it via Claude Code settings UI.

3. Use AskUserQuestion: "Also delete all qrec data? (~/.qrec/ including the database and logs)"
   Options: "Yes, delete everything" / "No, keep data"

   If yes:
   ```bash
   rm -rf ~/.qrec/
   ```
   Note: the embedding model is stored inside `~/.qrec/models/` — this removes it too.
   If you want to keep the model for future use:
   ```bash
   rm -rf ~/.qrec/qrec.db ~/.qrec/qrec.log ~/.qrec/qrec.pid ~/.qrec/install.log
   # keep ~/.qrec/models/
   ```

4. Confirm what was removed.
