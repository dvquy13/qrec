#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["pycookiecheat"]
# ///
"""
Extract Chrome cookies for a domain and save them to a cookie artifact file.

Usage:
    uv run extract-cookies.py --domain google.com --profile "Profile 2"
    uv run extract-cookies.py --domain app.lemonsqueezy.com --profile "Default"
    uv run extract-cookies.py --domain google.com --profile "Profile 2" --out ../cookies/google.com.json

The skill calls this script during /discover-metric to produce cookie files
that fetch-metrics.py reads at run time.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from pycookiecheat import chrome_cookies

# Canonical URL to use for cookie extraction per domain
# pycookiecheat needs a URL to know which cookies to pull
_DOMAIN_URL = {
    "google.com": "https://google.com",
    "app.lemonsqueezy.com": "https://app.lemonsqueezy.com",
    "chrome.google.com": "https://chrome.google.com",
    "console.firebase.google.com": "https://console.firebase.google.com",
    "analytics.google.com": "https://analytics.google.com",
}


def extract(domain: str, profile: str) -> dict:
    url = _DOMAIN_URL.get(domain, f"https://{domain}")
    cookie_file = (
        Path.home() / f"Library/Application Support/Google/Chrome/{profile}/Cookies"
    )
    if not cookie_file.exists():
        raise FileNotFoundError(
            f"Chrome cookie file not found: {cookie_file}\n"
            f"Make sure Chrome is open and profile '{profile}' exists."
        )
    cookies = chrome_cookies(url, cookie_file=str(cookie_file))
    if not cookies:
        raise ValueError(
            f"No cookies found for domain '{domain}' in profile '{profile}'.\n"
            f"Make sure you are logged in to {url} in Chrome."
        )
    return cookies


def main():
    parser = argparse.ArgumentParser(description="Extract Chrome cookies for a domain")
    parser.add_argument("--domain", required=True, help="Domain to extract cookies for (e.g. google.com)")
    parser.add_argument("--profile", required=True, help="Chrome profile name (e.g. 'Profile 2' or 'Default')")
    parser.add_argument(
        "--out",
        default=None,
        help="Output file path (default: ../cookies/{domain}.json relative to this script)",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    out_path = (
        Path(args.out)
        if args.out
        else script_dir / ".." / "cookies" / f"{args.domain}.json"
    )
    out_path = out_path.resolve()

    print(f"Extracting cookies for '{args.domain}' from Chrome profile '{args.profile}' ...", file=sys.stderr)
    try:
        cookies = extract(args.domain, args.profile)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "domain": args.domain,
        "profile": args.profile,
        "extracted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cookies": cookies,
    }
    with open(out_path, "w") as f:
        json.dump(artifact, f, indent=2)

    print(f"Saved {len(cookies)} cookie(s) to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
