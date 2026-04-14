#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-auth[requests]"]
# ///
"""
Fetch metrics using saved cookie files produced by extract-cookies.py.

Cookie files are read from ../cookies/{domain}.json (relative to this script),
or a custom directory via --cookie-dir. Run extract-cookies.py first if cookies
are missing or stale.

Extract types:
  regex    — regex on HTML/text response
  jsonpath — dot-notation path on JSON response

           Supports array filter syntax:
             "props.overview.charts[slug=revenue].total"
           finds the first array item where item["slug"] == "revenue",
           then continues traversal. More robust than numeric indices.

Cast types:
  string       — keep as string (default)
  int          — parse as integer
  float        — parse as float
  money_cents  — divide by 100, return as float (e.g. 384 → 3.84)

Inertia.js two-step fetch:
  Set "inertia": {"partial_data": "...", "partial_component": "..."} in request config.
  Step 1: GET page HTML → extract version from data-page attribute.
  Step 2: GET with X-Inertia headers + version → returns JSON.
  Version is auto-discovered; XSRF token is auto-applied from cookies.

Offline fixture tests:
  --fixture  reads from fixtures/{config_name}.txt instead of making HTTP requests.
             Fixtures are committed response bodies (no credentials). Use to validate
             extraction patterns without needing live auth.
"""

import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

CHROME_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ── Utilities ──────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_configs(config_dir: Path) -> list[dict]:
    configs = []
    for path in sorted(config_dir.glob("*.json")):
        with open(path) as f:
            configs.append(json.load(f))
    return configs


def resolve_url_templates(url: str) -> str:
    """Replace {{today}}, {{today-7d}}, etc. with actual dates."""
    today = date.today()
    replacements = {
        "{{today}}": today.strftime("%Y-%m-%d"),
        "{{today-7d}}": (today - timedelta(days=7)).strftime("%Y-%m-%d"),
        "{{today-28d}}": (today - timedelta(days=28)).strftime("%Y-%m-%d"),
        "{{today-30d}}": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
        "{{today-90d}}": (today - timedelta(days=90)).strftime("%Y-%m-%d"),
        "{{start_of_year}}": today.replace(month=1, day=1).strftime("%Y-%m-%d"),
        "{{start_of_month}}": today.replace(day=1).strftime("%Y-%m-%d"),
    }
    for template, value in replacements.items():
        url = url.replace(template, value)
    return url


# ── Cookie auth ────────────────────────────────────────────────────────────────

def load_cookie_file(domain: str, cookie_dir: Path) -> dict:
    path = cookie_dir / f"{domain}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Cookie file not found: {path}\n"
            f"Run: uv run scripts/extract-cookies.py --domain {domain} --profile <profile>"
        )
    with open(path) as f:
        artifact = json.load(f)
    return artifact["cookies"]


def cookies_header(cookies: dict) -> str:
    return "; ".join(f"{k}={v}" for k, v in cookies.items())


def load_secret(key: str, secrets_dir: Path) -> str | None:
    path = secrets_dir / "secrets.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f).get(key)


# ── Auth dispatch ──────────────────────────────────────────────────────────────

def resolve_auth(auth_cfg: dict, url: str, cookie_dir: Path) -> tuple[str, dict, dict]:
    """Return (url_with_auth_params, cookies, extra_headers).

    Auth types:
      none       — no auth (public pages)
      cookie     — Chrome cookie file (explicit or inferred from domain field)
      api_key    — API key appended as ?key=<value> (read from env var)

    Backward compat: configs without auth.type use the domain field to infer:
      domain=null  → none
      domain=str   → cookie
    """
    auth_type = auth_cfg.get("type")

    # Infer type from legacy domain-only format
    if auth_type is None:
        domain = auth_cfg.get("domain")
        auth_type = "cookie" if domain else "none"

    if auth_type == "none":
        return url, {}, {}

    elif auth_type == "cookie":
        domain = auth_cfg["domain"]
        cookies = load_cookie_file(domain, cookie_dir)
        return url, cookies, {}

    elif auth_type == "api_key":
        env_var = auth_cfg["env"]
        key = os.environ.get(env_var) or load_secret(env_var, cookie_dir.parent / "secrets")
        if not key:
            setup_hint = auth_cfg.get("setup", "see setup/ directory for instructions")
            raise RuntimeError(
                f"Missing API key: ${env_var} is not set.\n"
                f"Set it in secrets/secrets.json or as an environment variable.\n"
                f"Setup: {setup_hint}"
            )
        fmt = auth_cfg.get("format", "query")
        if fmt == "bearer":
            return url, {}, {"Authorization": f"Bearer {key}"}
        else:
            sep = "&" if "?" in url else "?"
            return url + sep + f"key={urllib.parse.quote(key, safe='')}", {}, {}

    elif auth_type == "oauth_adc":
        import google.auth
        import google.auth.transport.requests

        scopes = auth_cfg["scopes"]
        quota_project = auth_cfg.get("quota_project")
        try:
            credentials, _ = google.auth.default(scopes=scopes, quota_project_id=quota_project)
            credentials.refresh(google.auth.transport.requests.Request())
        except google.auth.exceptions.DefaultCredentialsError:
            raise RuntimeError(
                "Google ADC not configured. Run:\n"
                f"  gcloud auth application-default login --scopes={','.join(scopes)}\n"
                "  gcloud auth application-default set-quota-project <project>"
            )
        headers = {"Authorization": f"Bearer {credentials.token}"}
        if quota_project:
            headers["x-goog-user-project"] = quota_project
        return url, {}, headers

    elif auth_type == "service_account":
        import google.oauth2.service_account
        import google.auth.transport.requests

        creds_file = auth_cfg["credentials_file"]
        scopes = auth_cfg["scopes"]
        quota_project = auth_cfg.get("quota_project")

        # Resolve relative paths: cwd first, then skill base dir (parent of cookies/)
        creds_path = Path(creds_file)
        if not creds_path.is_absolute():
            cwd_path = (Path.cwd() / creds_file).resolve()
            skill_path = (cookie_dir.parent / creds_file).resolve()
            creds_path = cwd_path if cwd_path.exists() else skill_path
        if not creds_path.exists():
            raise FileNotFoundError(
                f"Service account credentials not found: {creds_path}\n"
                f"Download from GCP Console → IAM → Service Accounts → Keys"
            )
        credentials = google.oauth2.service_account.Credentials.from_service_account_file(
            str(creds_path), scopes=scopes
        )
        credentials.refresh(google.auth.transport.requests.Request())
        # Service accounts don't send x-goog-user-project — they're already project-scoped
        return url, {}, {"Authorization": f"Bearer {credentials.token}"}

    else:
        raise ValueError(f"Unknown auth type: {auth_type!r}. Expected: none, cookie, api_key, oauth_adc")


# ── HTTP fetching ──────────────────────────────────────────────────────────────

def fetch_url(
    url: str,
    cookies: dict,
    extra_headers: dict | None = None,
    method: str = "GET",
    body: dict | None = None,
) -> tuple[str, str]:
    """Fetch URL with optional cookies, headers, and JSON body. Returns (response_text, final_url)."""
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", CHROME_UA)
    if data:
        req.add_header("Content-Type", "application/json")
    if cookies:
        req.add_header("Cookie", cookies_header(cookies))
    if extra_headers:
        for k, v in extra_headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        final_url = resp.url
        body_text = resp.read().decode("utf-8", errors="replace")
    return body_text, final_url


def discover_inertia_version(url: str, cookies: dict) -> str:
    """GET page HTML (may redirect to auth page) and extract Inertia version.

    Works even when the target URL redirects to an auth challenge page, because
    Laravel/Inertia auth pages embed the same app version in their own data-page.
    """
    body, _ = fetch_url(url, cookies)

    # Standard: data-page attribute with HTML-encoded JSON
    m = re.search(r'data-page="([^"]+)"', body)
    if m:
        page_data = json.loads(html.unescape(m.group(1)))
        version = page_data.get("version", "")
        if version:
            return version

    # Fallback: bare "version":"<hash>" anywhere in HTML (e.g. Inertia JSON blob in redirect page)
    m2 = re.search(r'"version":"([0-9a-f]{32})"', body)
    if m2:
        return m2.group(1)

    raise ValueError("Inertia: could not find version in page HTML. Re-run extract-cookies.py.")


def fetch_inertia(url: str, cookies: dict, partial_data: str, partial_component: str) -> str:
    """Two-step Inertia.js fetch: auto-discover version, then fetch JSON."""
    version = discover_inertia_version(url, cookies)
    netloc = urllib.parse.urlparse(url).netloc

    inertia_headers = {
        "X-Inertia": "true",
        "X-Inertia-Version": version,
        "X-Inertia-Partial-Data": partial_data,
        "X-Inertia-Partial-Component": partial_component,
        "Accept": "application/json, text/plain, */*",
        "Origin": f"https://{netloc}",
        "Referer": url.split("?")[0],
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }

    # Auto-add XSRF token if present (Laravel requirement)
    if "XSRF-TOKEN" in cookies:
        inertia_headers["X-XSRF-TOKEN"] = urllib.parse.unquote(cookies["XSRF-TOKEN"])

    try:
        body, _ = fetch_url(url, cookies, extra_headers=inertia_headers)
        return body
    except urllib.error.HTTPError as e:
        if e.code == 409:
            domain = cookies and netloc
            raise RuntimeError(
                f"Inertia session stale (HTTP 409) — visit {netloc} in Chrome, then re-run:\n"
                f"  uv run scripts/extract-cookies.py --domain {netloc} --profile <profile>"
            ) from None
        raise


def check_auth_failure(body: str, final_url: str) -> str | None:
    if "accounts.google.com" in final_url:
        return "Auth failed — redirected to accounts.google.com login page"
    if "<title>Sign in</title>" in body:
        return "Auth failed — response contains sign-in page"
    return None


# ── Extraction ─────────────────────────────────────────────────────────────────

def extract_regex(body: str, extract_cfg: dict) -> str:
    pattern = extract_cfg["pattern"]
    group = extract_cfg.get("group", 1)
    match = re.search(pattern, body, re.DOTALL)
    if match is None:
        raise ValueError(f"Regex pattern did not match: {pattern!r}")
    return match.group(group)


# Matches "key[field=value]" segments in a jsonpath
_FILTER_RE = re.compile(r'^(\w+)\[(\w+)=([^\]]+)\]$')


def extract_jsonpath(data, path: str):
    """Dot-notation path traversal with optional array filter syntax.

    Examples:
      "props.overview.total"           — plain key traversal
      "data.0.attributes.name"         — numeric list index
      "charts[slug=revenue].total"     — find array item where item["slug"] == "revenue"
    """
    parts = path.split(".")
    current = data
    for part in parts:
        filter_match = _FILTER_RE.match(part)
        if filter_match:
            key, field, value = filter_match.group(1), filter_match.group(2), filter_match.group(3)
            # First traverse the key
            if not isinstance(current, dict) or key not in current:
                raise KeyError(f"Key {key!r} not found")
            arr = current[key]
            if not isinstance(arr, list):
                raise ValueError(f"{key!r} is not a list, cannot filter")
            # Find first item matching field=value
            found = next((item for item in arr if isinstance(item, dict) and str(item.get(field)) == value), None)
            if found is None:
                available = [item.get(field) for item in arr if isinstance(item, dict)]
                raise KeyError(f"No item where {field}={value!r}. Available {field} values: {available}")
            current = found
        elif isinstance(current, dict):
            if part not in current:
                raise KeyError(f"Key {part!r} not found. Available keys: {list(current.keys())}")
            current = current[part]
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError) as e:
                raise ValueError(f"List index error at {part!r}: {e}")
        else:
            raise ValueError(f"Cannot traverse {type(current).__name__} with key {part!r}")
    return current


def cast_value(raw, cast_type: str):
    if cast_type == "int":
        return int(raw)
    elif cast_type == "float":
        return float(raw)
    elif cast_type == "money_cents":
        return round(float(raw) / 100, 2)
    else:
        return raw  # default: string


def validate_value(value, validate_cfg: dict) -> str | None:
    min_val = validate_cfg.get("min")
    max_val = validate_cfg.get("max")
    if min_val is not None and value < min_val:
        return f"Value {value} is below minimum {min_val}"
    if max_val is not None and value > max_val:
        return f"Value {value} is above maximum {max_val}"
    return None


# ── Fixture loading ────────────────────────────────────────────────────────────

def load_fixture(name: str, fixture_dir: Path) -> str:
    path = fixture_dir / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(
            f"Fixture not found: {path}\n"
            f"Run without --fixture to fetch live, or save a fixture:\n"
            f"  uv run fetch-metrics.py --name {name} > /dev/null  # fetches live\n"
            f"  # Then capture the response manually to fixtures/{name}.txt"
        )
    return path.read_text(encoding="utf-8")


# ── Main fetch logic ───────────────────────────────────────────────────────────

def resolve_body_templates(body):
    """Recursively resolve URL template variables in string values of a request body."""
    if isinstance(body, dict):
        return {k: resolve_body_templates(v) for k, v in body.items()}
    elif isinstance(body, list):
        return [resolve_body_templates(item) for item in body]
    elif isinstance(body, str):
        return resolve_url_templates(body)
    else:
        return body


def fetch_metric(config: dict, cookie_dir: Path, fixture_dir: Path | None = None) -> dict:
    fetched_at = now_iso()
    name = config["name"]

    try:
        raw_url = config["request"]["url"]
        url = resolve_url_templates(raw_url)
        req_cfg = config["request"]

        # ── Fixture mode: skip all HTTP ──
        if fixture_dir is not None:
            print(f"[{name}] loading fixture ...", file=sys.stderr)
            body = load_fixture(name, fixture_dir)
        else:
            # ── Resolve auth ──
            auth_cfg = config.get("auth", {})
            url, cookies, extra_headers = resolve_auth(auth_cfg, url, cookie_dir)

            inertia_cfg = req_cfg.get("inertia")
            if inertia_cfg:
                print(f"[{name}] Inertia two-step fetch: {raw_url} ...", file=sys.stderr)
                body = fetch_inertia(
                    url,
                    cookies,
                    inertia_cfg["partial_data"],
                    inertia_cfg["partial_component"],
                )
            else:
                method = req_cfg.get("method", "GET").upper()
                req_body = req_cfg.get("body")
                if req_body is not None:
                    req_body = resolve_body_templates(req_body)
                print(f"[{name}] {method} {raw_url} ...", file=sys.stderr)
                body, final_url = fetch_url(url, cookies, extra_headers or None, method=method, body=req_body)
                auth_err = check_auth_failure(body, final_url)
                if auth_err:
                    return {"value": None, "status": "error", "error": auth_err, "fetched_at": fetched_at}

        # ── Extract ──
        extract_cfg = config["extract"]
        extract_type = extract_cfg["type"]

        if extract_type == "regex":
            raw = extract_regex(body, extract_cfg)
        elif extract_type == "jsonpath":
            data = json.loads(body)
            try:
                raw = extract_jsonpath(data, extract_cfg["path"])
            except (KeyError, ValueError, IndexError):
                if "default_value" in extract_cfg:
                    print(f"[{name}] path not found, using default_value={extract_cfg['default_value']!r}", file=sys.stderr)
                    return {"value": extract_cfg["default_value"], "status": "ok", "fetched_at": fetched_at}
                raise
        else:
            return {
                "value": None,
                "status": "error",
                "error": f"Unsupported extract type: {extract_type!r}",
                "fetched_at": fetched_at,
            }

        cast_type = extract_cfg.get("cast", "string")
        value = cast_value(raw, cast_type)

        if "validate" in config:
            validation_err = validate_value(value, config["validate"])
            if validation_err:
                return {
                    "value": value,
                    "status": "error",
                    "error": f"Validation failed: {validation_err}",
                    "fetched_at": fetched_at,
                }

        print(f"[{name}] extracted value={value!r}", file=sys.stderr)
        return {"value": value, "status": "ok", "fetched_at": fetched_at}

    except Exception as e:
        print(f"[{name}] error: {e}", file=sys.stderr)
        return {"value": None, "status": "error", "error": str(e), "fetched_at": fetched_at}


def main():
    parser = argparse.ArgumentParser(description="Fetch metrics from authenticated web dashboards")
    parser.add_argument("--name", help="Fetch only this metric by name")
    parser.add_argument("--test", action="store_true", help="Fetch all metrics and validate; exit 1 if any fail")
    parser.add_argument("--fixture", action="store_true", help="Use saved fixtures instead of live HTTP (offline, no auth needed)")
    parser.add_argument(
        "--config-dir",
        default=None,
        help="Config directory (default: ../configs relative to this script)",
    )
    parser.add_argument(
        "--cookie-dir",
        default=None,
        help="Cookie files directory (default: ../cookies relative to this script)",
    )
    parser.add_argument(
        "--fixture-dir",
        default=None,
        help="Fixture files directory (default: ../fixtures relative to this script)",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    config_dir = Path(args.config_dir) if args.config_dir else script_dir / ".." / "configs"
    config_dir = config_dir.resolve()
    cookie_dir = Path(args.cookie_dir) if args.cookie_dir else script_dir / ".." / "cookies"
    cookie_dir = cookie_dir.resolve()
    fixture_dir: Path | None = None
    if args.fixture:
        fixture_dir = Path(args.fixture_dir) if args.fixture_dir else script_dir / ".." / "fixtures"
        fixture_dir = fixture_dir.resolve()

    if not config_dir.exists():
        print(f"Config directory not found: {config_dir}", file=sys.stderr)
        sys.exit(1)

    configs = load_configs(config_dir)
    if not configs:
        print(f"No *.json configs found in {config_dir}", file=sys.stderr)
        sys.exit(1)

    if args.name:
        configs = [c for c in configs if c["name"] == args.name]
        if not configs:
            print(f"No config found with name={args.name!r}", file=sys.stderr)
            sys.exit(1)

    results = {}
    for config in configs:
        results[config["name"]] = fetch_metric(config, cookie_dir, fixture_dir)

    output = {"fetched_at": now_iso(), "metrics": results}
    print(json.dumps(output, indent=2))

    if args.test:
        failures = [name for name, r in results.items() if r["status"] != "ok"]
        if failures:
            print(f"\n[--test] FAILED metrics: {failures}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"[--test] All {len(results)} metric(s) passed.", file=sys.stderr)


if __name__ == "__main__":
    main()
