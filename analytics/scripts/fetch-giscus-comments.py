#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
Fetch total comment count across all Giscus discussions.

Giscus stores comments as GitHub Discussions in the configured repo.
This script queries the GitHub GraphQL API, paginates through all discussions,
and sums the top-level comment count per post.

Auth: GITHUB_TOKEN env var (required — GitHub GraphQL API requires auth even for public repos)

Usage:
  uv run scripts/fetch-giscus-comments.py
  uv run scripts/fetch-giscus-comments.py --test    # exit 1 if error
  uv run scripts/fetch-giscus-comments.py --fixture # offline mode (reads fixtures/giscus_total_comments.txt)

Output (same format as fetch-metrics.py):
  {"fetched_at": "...", "metrics": {"giscus_total_comments": {"value": 7, "status": "ok", "fetched_at": "..."}}}
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_OWNER = "dvquy13"
REPO_NAME = "icy-touch-comments"
METRIC_NAME = "giscus_total_comments"

GRAPHQL_URL = "https://api.github.com/graphql"

QUERY = """
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    discussions(first: 100, after: $cursor) {
      nodes {
        title
        comments {
          totalCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def graphql_request(query: str, variables: dict, token: str) -> dict:
    payload = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        GRAPHQL_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "metric-extractor/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def fetch_total_comments(token: str) -> int:
    total = 0
    cursor = None

    while True:
        variables = {"owner": REPO_OWNER, "name": REPO_NAME, "cursor": cursor}
        data = graphql_request(QUERY, variables, token)

        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {data['errors']}")

        discussions = data["data"]["repository"]["discussions"]
        nodes = discussions["nodes"]

        for discussion in nodes:
            total += discussion["comments"]["totalCount"]

        page_info = discussions["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]
        print(f"[{METRIC_NAME}] paginating, cursor={cursor!r} ...", file=sys.stderr)

    return total


def get_github_token() -> str:
    """Return GitHub token from env var or gh CLI."""
    token = os.environ.get("GITHUB_TOKEN", "")
    if token:
        return token
    # Fall back to gh CLI token
    try:
        import subprocess
        result = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            token = result.stdout.strip()
            if token:
                print(f"[{METRIC_NAME}] using token from gh CLI", file=sys.stderr)
                return token
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    raise RuntimeError(
        "No GitHub token found. Set GITHUB_TOKEN env var or run: gh auth login\n"
        "Generate a token at: github.com → Settings → Developer settings → Personal access tokens"
    )


def main():
    parser = argparse.ArgumentParser(description="Fetch total Giscus comment count via GitHub GraphQL API")
    parser.add_argument("--test", action="store_true", help="Exit 1 if metric fails")
    parser.add_argument("--fixture", action="store_true", help="Use saved fixture instead of live HTTP")
    parser.add_argument(
        "--fixture-dir",
        default=None,
        help="Fixture directory (default: ../fixtures relative to this script)",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    fixture_dir = Path(args.fixture_dir) if args.fixture_dir else script_dir / ".." / "fixtures"
    fixture_dir = fixture_dir.resolve()

    fetched_at = now_iso()

    try:
        if args.fixture:
            fixture_path = fixture_dir / f"{METRIC_NAME}.txt"
            if not fixture_path.exists():
                raise FileNotFoundError(f"Fixture not found: {fixture_path}")
            print(f"[{METRIC_NAME}] loading fixture ...", file=sys.stderr)
            value = int(fixture_path.read_text().strip())
        else:
            token = get_github_token()

            print(f"[{METRIC_NAME}] querying GitHub GraphQL API for {REPO_OWNER}/{REPO_NAME} ...", file=sys.stderr)
            value = fetch_total_comments(token)
            print(f"[{METRIC_NAME}] extracted value={value!r}", file=sys.stderr)

        result = {"value": value, "status": "ok", "fetched_at": fetched_at}

    except Exception as e:
        print(f"[{METRIC_NAME}] error: {e}", file=sys.stderr)
        result = {"value": None, "status": "error", "error": str(e), "fetched_at": fetched_at}

    output = {"fetched_at": now_iso(), "metrics": {METRIC_NAME: result}}
    print(json.dumps(output, indent=2))

    if args.test and result["status"] != "ok":
        print(f"\n[--test] FAILED: {METRIC_NAME}", file=sys.stderr)
        sys.exit(1)
    elif args.test:
        print(f"[--test] {METRIC_NAME} passed.", file=sys.stderr)


if __name__ == "__main__":
    main()
