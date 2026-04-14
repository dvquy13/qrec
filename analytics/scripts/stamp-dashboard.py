#!/usr/bin/env python3
"""
Stamp a metrics snapshot into a dashboard HTML file as a <noscript> block.

AI agents visiting the dashboard URL get empty HTML because data loads via
client-side JS (Supabase REST). Agents can't execute JS, so they see no metrics.
This script injects the latest snapshot directly into the HTML so any HTTP fetch
returns machine-readable metrics.

Usage:
    python3 scripts/stamp-dashboard.py \
        --snapshot /tmp/metrics.json \
        --dashboard analytics/dashboard.html

The <noscript id="metrics-snapshot"> block is:
  - Invisible to human users (browsers with JS skip <noscript>)
  - Idempotent: re-running replaces the existing block, never duplicates
  - Placed immediately before </div> that closes .app-container

Snapshot JSON format (output of push-and-notify.py or a merged metrics file):
    {"fetched_at": "2026-04-12T20:13:00Z", "metrics": {"visitors": {"value": 1250}, ...}}
"""

import argparse
import json
import re
import sys
from pathlib import Path

NOSCRIPT_OPEN = '<noscript id="metrics-snapshot"'
NOSCRIPT_PATTERN = re.compile(
    r'<noscript id="metrics-snapshot"[^>]*>.*?</noscript>',
    re.DOTALL,
)


def build_block(snapshot: dict) -> str:
    fetched_at = snapshot.get("fetched_at", "unknown")
    metrics = snapshot.get("metrics", {})

    lines = ["--- Metrics Snapshot ---", f"Fetched: {fetched_at}", ""]
    for key, entry in metrics.items():
        if not isinstance(entry, dict):
            lines.append(f"{key}: {entry}")
            continue
        status = entry.get("status", "ok")
        if status == "error":
            reason = entry.get("error", "unknown error")
            lines.append(f"{key}: ERROR ({reason})")
        else:
            val = entry.get("value", "")
            if isinstance(val, list):
                # Ranking metric: show top 3 inline
                top = ", ".join(f"{label}: {n}" for label, n in val[:3])
                lines.append(f"{key}: [{top}]")
            else:
                lines.append(f"{key}: {val}")
    lines.append("---")

    data_json = json.dumps(snapshot, separators=(",", ":"))
    # Escape single quotes in JSON for the attribute value
    data_json_escaped = data_json.replace("'", "&#39;")
    plain_text = "\n".join(lines)

    return (
        f'<noscript id="metrics-snapshot" data-json=\'{data_json_escaped}\'>\n'
        f"<pre>\n{plain_text}\n</pre>\n"
        f"</noscript>"
    )


def stamp(snapshot_path: Path, dashboard_path: Path) -> None:
    if not snapshot_path.exists():
        print(
            f"[stamp-dashboard] WARNING: snapshot not found: {snapshot_path} — skipping",
            file=sys.stderr,
        )
        return
    if not dashboard_path.exists():
        print(
            f"[stamp-dashboard] WARNING: dashboard not found: {dashboard_path} — skipping",
            file=sys.stderr,
        )
        return

    snapshot = json.loads(snapshot_path.read_text())
    html = dashboard_path.read_text()
    block = build_block(snapshot)

    if NOSCRIPT_PATTERN.search(html):
        # Replace existing block
        updated = NOSCRIPT_PATTERN.sub(block, html, count=1)
    else:
        # Insert before closing </div> of the app container
        updated = html.replace(
            '\n</div>\n<script>',
            f'\n\n  {block}\n\n</div>\n<script>',
            1,
        )
        if updated == html:
            # Fallback: append before </body>
            updated = html.replace("</body>", f"  {block}\n</body>", 1)

    dashboard_path.write_text(updated)
    metric_count = len(snapshot.get("metrics", {}))
    print(
        f"[stamp-dashboard] Stamped {metric_count} metrics into {dashboard_path} "
        f"(fetched_at={snapshot.get('fetched_at', '?')})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--snapshot", required=True, help="Path to snapshot JSON file")
    parser.add_argument("--dashboard", required=True, help="Path to dashboard HTML file")
    args = parser.parse_args()

    stamp(Path(args.snapshot), Path(args.dashboard))


if __name__ == "__main__":
    main()
