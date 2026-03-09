Uninstall qrec cleanly.

Steps:
1. Stop the daemon: `bun run /path/to/qrec/src/cli.ts stop` (or `qrec stop` if in PATH)
2. Remove the plugin from Claude Code settings
3. Optionally remove data: `rm -rf ~/.qrec/` (keeps model cache at ~/.cache/qmd/models/)
4. Confirm uninstall is complete

Note: The embedding model at ~/.cache/qmd/models/ is shared with QMD — only remove if QMD is also uninstalled.
