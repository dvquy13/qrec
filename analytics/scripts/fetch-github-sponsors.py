#!/usr/bin/env python3
"""
Fetch GitHub Sponsors metrics for dvquy13.
Emits JSONL to stdout — one line per metric.

Auth: GITHUB_TOKEN env var (auto-injected by Actions; locally use `gh auth token`).
"""
import json
import os
import sys
import urllib.request
import urllib.error


GRAPHQL_URL = "https://api.github.com/graphql"
QUERY = """
{ user(login: "dvquy13") {
    lifetimeReceivedSponsorshipValues(first: 100) {
      nodes { amountInCents formattedAmount }
      pageInfo { hasNextPage endCursor }
    }
    estimatedNextSponsorsPayoutInCents
    monthlyEstimatedSponsorsIncomeInCents
} }
"""


def graphql(token: str, query: str) -> dict:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        GRAPHQL_URL,
        data=payload,
        headers={
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "metric-extractor/1.0",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        # Fallback: try `gh auth token` locally
        import subprocess
        try:
            result = subprocess.run(
                ["gh", "auth", "token"], capture_output=True, text=True, check=True
            )
            token = result.stdout.strip()
        except Exception as e:
            print(
                json.dumps({"name": "github_sponsors_lifetime", "value": None, "status": "error", "error": f"No GITHUB_TOKEN and gh auth failed: {e}"}),
                file=sys.stdout,
            )
            return

    try:
        data = graphql(token, QUERY)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        for name in ("github_sponsors_lifetime", "github_sponsors_next_payout", "github_sponsors_monthly_est"):
            print(json.dumps({"name": name, "value": None, "status": "error", "error": f"HTTP {e.code}: {body}"}))
        return

    if "errors" in data:
        for name in ("github_sponsors_lifetime", "github_sponsors_next_payout", "github_sponsors_monthly_est"):
            print(json.dumps({"name": name, "value": None, "status": "error", "error": str(data["errors"])}))
        return

    user = data["data"]["user"]

    # --- lifetime received ---
    lifetime_nodes = user["lifetimeReceivedSponsorshipValues"]["nodes"]
    has_next = user["lifetimeReceivedSponsorshipValues"]["pageInfo"]["hasNextPage"]
    if has_next:
        # Simple pagination: re-fetch with cursor (edge case — currently 0 sponsors)
        # For now emit a warning; full pagination left as a future improvement
        print(json.dumps({"name": "github_sponsors_lifetime", "value": None, "status": "error", "error": "Pagination required — more than 100 lifetime sponsors"}))
    else:
        lifetime_usd = sum(n["amountInCents"] for n in lifetime_nodes) / 100.0
        print(json.dumps({"name": "github_sponsors_lifetime", "value": lifetime_usd, "status": "ok"}))

    # --- next payout ---
    next_payout_cents = user.get("estimatedNextSponsorsPayoutInCents") or 0
    print(json.dumps({"name": "github_sponsors_next_payout", "value": next_payout_cents / 100.0, "status": "ok"}))

    # --- monthly estimate ---
    monthly_cents = user.get("monthlyEstimatedSponsorsIncomeInCents") or 0
    print(json.dumps({"name": "github_sponsors_monthly_est", "value": monthly_cents / 100.0, "status": "ok"}))


if __name__ == "__main__":
    main()
