#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""
Read fetch output JSON from stdin, insert snapshot into Supabase, send alerts.

Usage:
    uv run scripts/fetch-metrics.py | uv run scripts/push-and-notify.py

Env vars:
    SUPABASE_URL              — Supabase project URL (required)
    SUPABASE_SERVICE_ROLE_KEY — Supabase service role key for writes (required)

Notifiers (all optional — skipped if not configured in alerts.yaml):
    Telegram: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_ID
    Discord:  DISCORD_WEBHOOK_URL (or custom env var via discord.webhook_url_env)
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

import yaml


# ── Supabase storage ───────────────────────────────────────────────────────────

def supabase_get_latest(url: str, key: str, table: str) -> dict | None:
    """Return the most recent snapshot from Supabase, or None on failure."""
    endpoint = f"{url}/rest/v1/{table}?order=fetched_at.desc&limit=1&select=fetched_at,metrics"
    req = urllib.request.Request(
        endpoint,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            rows = json.loads(resp.read())
            if rows:
                return {"fetched_at": rows[0]["fetched_at"], "metrics": rows[0]["metrics"]}
    except Exception as e:
        print(f"[push-and-notify] WARNING: Supabase get latest failed: {e}", file=sys.stderr)
    return None


def supabase_insert(url: str, key: str, table: str, snapshot: dict) -> None:
    """Insert a new snapshot row into Supabase."""
    endpoint = f"{url}/rest/v1/{table}"
    payload = json.dumps({
        "fetched_at": snapshot["fetched_at"],
        "metrics": snapshot["metrics"],
    }).encode()
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        _ = resp.read()


# ── Alert evaluation (shared) ──────────────────────────────────────────────────

def evaluate_alerts(alert_cfg: list, current: dict, previous: dict | None) -> list[dict]:
    """Evaluate alert rules and return structured alert dicts."""
    alerts = []
    current_metrics = current.get("metrics", {})
    prev_metrics = (previous or {}).get("metrics", {})

    for rule in alert_cfg:
        rule_type = rule.get("type")

        if rule_type == "failure":
            errors = [
                {"metric": name, "error": m.get("error", "unknown error")}
                for name, m in current_metrics.items()
                if m.get("status") == "error"
            ]
            if errors:
                alerts.append({"type": "failure", "errors": errors})

        elif rule_type == "daily_digest":
            labels = rule.get("labels", {})
            metrics = []
            for name, curr_entry in current_metrics.items():
                label = labels.get(name, name)
                if curr_entry.get("status") != "ok":
                    metrics.append({"name": name, "label": label, "value": None, "delta": None, "status": "error", "error": curr_entry.get("error", "unknown")})
                    continue
                curr_val = curr_entry["value"]
                delta = None
                prev_entry = prev_metrics.get(name)
                if prev_entry and prev_entry.get("status") == "ok":
                    try:
                        delta = float(curr_val) - float(prev_entry["value"])
                    except (TypeError, ValueError):
                        pass
                metrics.append({"name": name, "label": label, "value": curr_val, "delta": delta, "status": "ok"})
            alerts.append({
                "type": "daily_digest",
                "title": rule.get("title", "Metrics"),
                "date": current.get("fetched_at", "")[:10],
                "prev_fetched_at": (previous or {}).get("fetched_at"),
                "metrics": metrics,
            })

        elif rule_type == "metric_change":
            metric = rule["metric"]
            label = rule.get("label", metric)
            direction = rule.get("direction", "any")
            min_delta = rule.get("min_delta", 1)

            curr_entry = current_metrics.get(metric)
            prev_entry = prev_metrics.get(metric)
            if not curr_entry or curr_entry.get("status") != "ok":
                continue
            if not prev_entry or prev_entry.get("status") != "ok":
                continue

            try:
                delta = float(curr_entry["value"]) - float(prev_entry["value"])
            except (TypeError, ValueError):
                continue

            if abs(delta) < min_delta:
                continue
            if direction == "increase" and delta <= 0:
                continue
            if direction == "decrease" and delta >= 0:
                continue

            alerts.append({
                "type": "metric_change",
                "label": label,
                "prev_val": prev_entry["value"],
                "curr_val": curr_entry["value"],
                "delta": delta,
            })

    return alerts


# ── Telegram ───────────────────────────────────────────────────────────────────

def _format_telegram(alert: dict) -> str:
    if alert["type"] == "failure":
        lines = ["⚠️ <b>Metrics fetch failed</b>"]
        for e in alert["errors"]:
            lines.append(f"  {e['metric']}: {e['error']}")
        return "\n".join(lines)

    if alert["type"] == "daily_digest":
        lines = [f"📊 <b>{alert['title']}</b> — {alert['date']}", ""]
        for m in alert["metrics"]:
            if m["status"] != "ok":
                lines.append(f"• {m['name']}: ⚠️ error")
                continue
            delta_str = ""
            if m["delta"] is not None:
                d = m["delta"]
                if d > 0:
                    delta_str = f" (+{d:g}) 📈"
                elif d < 0:
                    delta_str = f" ({d:g}) 📉"
                else:
                    delta_str = " (no change)"
            lines.append(f"• {m['name']}: {m['value']}{delta_str}")
        prev_ts = alert.get("prev_fetched_at")
        if prev_ts:
            lines.append(f"\n<i>Δ vs snapshot from {prev_ts[:16].replace('T', ' ')} UTC</i>")
        else:
            lines.append("\n<i>No prior snapshot — first run</i>")
        return "\n".join(lines)

    if alert["type"] == "metric_change":
        delta = alert["delta"]
        sign = "+" if delta > 0 else ""
        arrow = "📈" if delta > 0 else "📉"
        return f"{arrow} {alert['label']}: {alert['prev_val']} → {alert['curr_val']} ({sign}{delta:g})"

    return str(alert)


def telegram_send(bot_token: str, chat_id: str, text: str, topic_id: str | None = None) -> None:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload_dict: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if topic_id:
        payload_dict["message_thread_id"] = int(topic_id)
    payload = json.dumps(payload_dict).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        _ = resp.read()


def notify_telegram(alerts: list[dict], tg_cfg: dict) -> None:
    bot_token = os.environ.get(tg_cfg.get("bot_token_env", "TELEGRAM_BOT_TOKEN"), "")
    chat_id = os.environ.get(tg_cfg.get("chat_id_env", "TELEGRAM_CHAT_ID"), "")
    topic_id = os.environ.get(tg_cfg.get("topic_id_env", "TELEGRAM_TOPIC_ID"), "") or None

    if not bot_token or not chat_id:
        print("[push-and-notify] Telegram: token/chat_id not set — skipping", file=sys.stderr)
        return

    for alert in alerts:
        text = _format_telegram(alert)
        try:
            telegram_send(bot_token, chat_id, text, topic_id)
            print(f"[push-and-notify] Telegram sent: {text[:60]!r}", file=sys.stderr)
        except Exception as e:
            print(f"[push-and-notify] WARNING: Telegram send failed: {e}", file=sys.stderr)


# ── Discord ────────────────────────────────────────────────────────────────────

_GREEN = 3066993
_RED   = 15158332


def _format_discord_payload(alert: dict, dashboard_url: str | None) -> dict:
    if alert["type"] == "failure":
        desc = "\n".join(f"• **{e['metric']}**: {e['error']}" for e in alert["errors"])
        return {"embeds": [{"title": "⚠️ Metrics fetch failed", "color": _RED, "description": desc}]}

    if alert["type"] == "daily_digest":
        has_errors = any(m["status"] != "ok" for m in alert["metrics"])
        color = _RED if has_errors else _GREEN
        fields = []
        for m in alert["metrics"]:
            if m["status"] != "ok":
                value = "⚠️ error"
            else:
                val = m["value"]
                delta = m["delta"]
                if delta is None:
                    value = f"**{val}**"
                elif delta > 0:
                    value = f"**{val}** 🟢 +{delta:g}"
                elif delta < 0:
                    value = f"**{val}** 🔻 {delta:g}"
                else:
                    value = f"**{val}**"
            fields.append({"name": m["label"], "value": value, "inline": True})

        embed: dict = {
            "title": f"{alert['title']} · Daily Digest · {alert['date']}",
            "color": color,
            "fields": fields,
        }
        if dashboard_url:
            embed["url"] = dashboard_url
        prev_ts = alert.get("prev_fetched_at")
        if prev_ts:
            try:
                from datetime import datetime, timezone
                dt = datetime.fromisoformat(prev_ts).astimezone(timezone.utc)
                unix = int(dt.timestamp())
                embed["description"] = f"Δ vs <t:{unix}:R>"
            except Exception:
                embed["description"] = f"Δ vs snapshot from {prev_ts[:16].replace('T', ' ')} UTC"
        else:
            embed["description"] = "No prior snapshot — first run"
        return {"embeds": [embed]}

    if alert["type"] == "metric_change":
        delta = alert["delta"]
        sign = "+" if delta > 0 else ""
        icon = "🟢" if delta > 0 else "🔻"
        color = _GREEN if delta > 0 else _RED
        return {"embeds": [{
            "title": f"{icon} {alert['label']}",
            "color": color,
            "description": f"**{alert['prev_val']}** → **{alert['curr_val']}** ({sign}{delta:g})",
        }]}

    return {"content": str(alert)}


def discord_send(webhook_url: str, payload: dict) -> None:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(webhook_url, data=data, headers={"Content-Type": "application/json", "User-Agent": "metric-extractor/1.0"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        _ = resp.read()


def notify_discord(alerts: list[dict], discord_cfg: dict) -> None:
    webhook_url = os.environ.get(discord_cfg.get("webhook_url_env", "DISCORD_WEBHOOK_URL"), "")
    if not webhook_url:
        print("[push-and-notify] Discord: DISCORD_WEBHOOK_URL not set — skipping", file=sys.stderr)
        return

    dashboard_url = discord_cfg.get("dashboard_url") or None

    for alert in alerts:
        payload = _format_discord_payload(alert, dashboard_url)
        try:
            discord_send(webhook_url, payload)
            print(f"[push-and-notify] Discord sent: type={alert['type']}", file=sys.stderr)
        except Exception as e:
            print(f"[push-and-notify] WARNING: Discord send failed: {e}", file=sys.stderr)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    # 1. Read fetch output from stdin
    raw = sys.stdin.read().strip()
    if not raw:
        print("[push-and-notify] stdin is empty — nothing to do", file=sys.stderr)
        sys.exit(1)
    try:
        snapshot = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[push-and-notify] invalid JSON on stdin: {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Load alerts config
    script_dir = Path(__file__).parent
    alerts_path = (script_dir / ".." / "alerts.yaml").resolve()
    if not alerts_path.exists():
        print(f"[push-and-notify] alerts config not found: {alerts_path}", file=sys.stderr)
        sys.exit(1)
    with open(alerts_path) as f:
        alerts_cfg = yaml.safe_load(f)

    alert_rules = alerts_cfg.get("alerts", [])

    # 3. Supabase: read previous snapshot, insert current
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_table = alerts_cfg.get("supabase", {}).get("table", "metrics_snapshots")

    if not supabase_url or not supabase_key:
        print("[push-and-notify] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — skipping storage", file=sys.stderr)
        previous = None
    else:
        previous = supabase_get_latest(supabase_url, supabase_key, supabase_table)
        print(f"[push-and-notify] previous snapshot: {(previous or {}).get('fetched_at', 'none')}", file=sys.stderr)
        supabase_insert(supabase_url, supabase_key, supabase_table, snapshot)
        print(f"[push-and-notify] inserted snapshot fetched_at={snapshot['fetched_at']} into {supabase_table}", file=sys.stderr)

    # 4. Evaluate alerts
    alerts = evaluate_alerts(alert_rules, snapshot, previous)

    # 5. Notify via configured channels
    if not alerts:
        print("[push-and-notify] no alerts triggered", file=sys.stderr)
        return

    if "telegram" in alerts_cfg:
        notify_telegram(alerts, alerts_cfg["telegram"])

    if "discord" in alerts_cfg:
        notify_discord(alerts, alerts_cfg["discord"])


if __name__ == "__main__":
    main()
