"""Generate a self-contained HTML eval report. Inter Variable font, white background."""
import html as _html
import json
from pathlib import Path


def _status(value: float, target: float, higher_better: bool = True) -> str:
    ok    = value >= target if higher_better else value <= target
    close = (value >= target * 0.93) if higher_better else (value <= target * 1.07)
    return "pass" if ok else ("close" if close else "fail")


BADGE = {
    "pass":  '<span class="badge pass">✓ Pass</span>',
    "close": '<span class="badge close">~ Close</span>',
    "fail":  '<span class="badge fail">✗ Fail</span>',
    "info":  '<span class="badge info">—</span>',
}

DIAG_COLOR = {
    "COMPETING_SESSIONS": "#f59e0b",
    "RANKED_LOW":         "#3b82f6",
    "NOT_RETRIEVED":      "#ef4444",
}

def _e(s) -> str:
    return _html.escape(str(s))

def _fmt_rss(kb: int) -> str:
    return f"{kb // 1024} MB" if kb else "—"


def generate(results: dict, out_path: Path) -> None:
    meta   = results["meta"]
    qg     = results.get("query_gen", {})
    idx    = results.get("indexing", {})
    ev     = results["eval"]
    ea     = results.get("error_analysis", {})
    qs     = results.get("queries", [])
    config = meta.get("config", {})
    k      = meta.get("k", 10)

    metrics = [
        ("Found@10",      f"{ev['found_at_k']*100:.1f}%",          "≥ 90%",    _status(ev["found_at_k"], 0.90)),
        ("NDCG@10",       f"{ev['ndcg_at_k']:.4f}",                "≥ 0.75",   _status(ev["ndcg_at_k"], 0.75)),
        ("Latency p50",   f"{ev['latency_p50_ms']:.0f} ms",        "< 100 ms", _status(ev["latency_p50_ms"], 100, False)),
        ("Latency p95",   f"{ev['latency_p95_ms']:.0f} ms",        "< 300 ms", _status(ev["latency_p95_ms"], 300, False)),
        ("RSS startup",   _fmt_rss(ev["rss_startup_kb"]),           "< 500 MB", _status(ev["rss_startup_kb"], 500*1024, False)),
        ("RSS post-eval", _fmt_rss(ev["rss_post_eval_kb"]),         "—",        "info"),
    ]

    # ── Error analysis HTML ───────────────────────────────────────────────────
    ea_html = ""
    if not ea.get("groups"):
        ea_html = "<p class='muted'>No missed queries — all found in top-10. 🎉</p>"
    else:
        ea_html += f"<p class='muted' style='margin-bottom:16px'>{ea.get('total_missed',0)} missed / {ev['queries_run']} queries</p>"
        for diag, group in ea.get("groups", {}).items():
            color = DIAG_COLOR.get(diag, "#6b7280")
            rows = ""
            for q in group.get("queries", []):
                rank_str = f"rank #{q['rank_of_relevant']}" if q.get("rank_of_relevant") else "not retrieved"
                top3 = ", ".join(q.get("retrieved_ids", [])[:3])
                rows += f"""
              <details class="qrow">
                <summary>
                  <code class="sid">{_e(q['session_id'])}</code>
                  <span class="qt">{_e(q['query'])}</span>
                  <span class="rank">{rank_str}</span>
                </summary>
                <div class="qdetail">
                  <div class="kv"><span>Style</span><span>{_e(q.get('style','—'))}</span></div>
                  <div class="kv"><span>Top retrieved</span><code>{_e(top3 or '—')}</code></div>
                  <div class="kv"><span>Latency</span><span>{q.get('latency_ms','—')} ms</span></div>
                  <div class="kv"><span>Diagnosis</span><span style="color:{color};font-weight:600">{_e(diag)}</span></div>
                </div>
              </details>"""
            ea_html += f"""
          <div class="group">
            <div class="group-hdr" style="border-left:4px solid {color}">
              <span class="group-label" style="color:{color}">{_e(diag)}</span>
              <span class="group-count">{group['count']} quer{"y" if group['count']==1 else "ies"}</span>
              <p class="group-hyp">{_e(group.get('hypothesis',''))}</p>
            </div>
            <div class="group-qs">{rows}</div>
          </div>"""

    # ── All queries table ─────────────────────────────────────────────────────
    q_rows = ""
    for q in qs:
        cls  = "found" if q["found"] else "missed"
        rank = str(q.get("rank_of_relevant") or "—")
        text = _e(q["query"][:90]) + ("…" if len(q["query"]) > 90 else "")
        diag_badge = ""
        if not q["found"]:
            d = q.get("diagnosis", "")
            c = DIAG_COLOR.get(d, "#6b7280")
            diag_badge = f'<span style="color:{c};font-size:11px;font-weight:600">{_e(d)}</span>'
        q_rows += f"""
        <tr class="{cls}">
          <td><code>{_e(q['session_id'])}</code></td>
          <td class="qt-col">{text}</td>
          <td class="ctr">{"✓" if q["found"] else "✗"}</td>
          <td class="ctr">{rank}</td>
          <td class="ctr">{q['ndcg']:.3f}</td>
          <td class="ctr">{q['latency_ms']:.0f}</td>
          <td>{diag_badge}</td>
        </tr>"""

    stat_seed = config.get("indexing", {}).get("seed", "—")
    stat_sessions = qg.get("sessions_sampled", idx.get("sessions_indexed", "—"))

    out = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>qrec eval — {_e(meta.get('run_name',''))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#111;font-size:14px;line-height:1.6}}
.page{{max-width:960px;margin:0 auto;padding:48px 24px 96px}}
h1{{font-size:22px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px}}
h2{{font-size:14px;font-weight:600;color:#374151;margin:40px 0 14px;text-transform:uppercase;letter-spacing:.5px}}
.muted{{color:#6b7280;font-size:13px}}
.run-meta{{color:#9ca3af;font-size:12px;margin-bottom:36px;display:flex;gap:20px;flex-wrap:wrap}}
code{{font-family:'SF Mono','Fira Code',monospace;font-size:12px;background:#f3f4f6;padding:1px 5px;border-radius:4px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:28px}}
.card{{border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px}}
.card-label{{font-size:11px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:.4px}}
.card-value{{font-size:22px;font-weight:700;letter-spacing:-.5px;margin-top:2px}}
.card-sub{{font-size:11px;color:#9ca3af;margin-top:2px}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{text-align:left;font-weight:600;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;padding:8px 12px;border-bottom:1px solid #e5e7eb}}
td{{padding:10px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top}}
tr:last-child td{{border-bottom:none}}
.ctr{{text-align:center}}
.qt-col{{max-width:320px}}
.found td{{background:#f0fdf4}}
.missed td{{background:#fff7f7}}
.badge{{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px}}
.badge.pass{{background:#dcfce7;color:#15803d}}
.badge.close{{background:#fef9c3;color:#a16207}}
.badge.fail{{background:#fee2e2;color:#dc2626}}
.badge.info{{background:#f3f4f6;color:#6b7280}}
.group{{border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;overflow:hidden}}
.group-hdr{{padding:14px 16px;background:#fafafa}}
.group-label{{font-weight:700;font-size:13px}}
.group-count{{float:right;font-size:12px;color:#6b7280;font-weight:500}}
.group-hyp{{font-size:12px;color:#6b7280;margin-top:4px;clear:both}}
.group-qs{{padding:0 16px 4px}}
details.qrow{{border-top:1px solid #f3f4f6;padding:8px 0}}
details.qrow summary{{cursor:pointer;list-style:none;display:flex;align-items:baseline;gap:10px;user-select:none}}
details.qrow summary::-webkit-details-marker{{display:none}}
.sid{{flex-shrink:0}}
.qt{{color:#374151;flex:1;font-size:13px}}
.rank{{font-size:11px;color:#9ca3af;white-space:nowrap}}
.qdetail{{padding:8px 0 4px 16px;display:grid;gap:6px}}
.kv{{display:flex;gap:12px;font-size:12px;color:#6b7280}}
.kv span:first-child{{font-weight:500;min-width:110px;flex-shrink:0}}
details.all-qs>summary{{cursor:pointer;font-size:13px;font-weight:600;color:#6b7280;padding:8px 0;user-select:none}}
.config-block{{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:12px}}
.config-block pre{{white-space:pre-wrap;font-family:'SF Mono','Fira Code',monospace;color:#374151;line-height:1.7}}
</style>
</head>
<body>
<div class="page">

<h1>qrec eval — {_e(meta.get('run_name','unnamed'))}</h1>
<div class="run-meta">
  <span>{_e(meta.get('timestamp','')[:19].replace('T',' '))}</span>
  <span>git {_e(meta.get('git_hash','?'))}</span>
  <span>run fingerprint {_e(meta.get('run_fingerprint','?'))}</span>
  <span>{_e(meta.get('experiment',''))}</span>
</div>

<h2>Pipeline</h2>
<div class="grid">
  <div class="card">
    <div class="card-label">Sessions sampled</div>
    <div class="card-value">{_e(stat_sessions)}</div>
    <div class="card-sub">seed={_e(stat_seed)}</div>
  </div>
  <div class="card">
    <div class="card-label">Cache hits</div>
    <div class="card-value">{_e(qg.get('cache_hits','—'))}</div>
    <div class="card-sub">{_e(qg.get('cache_misses','—'))} misses → LLM</div>
  </div>
  <div class="card">
    <div class="card-label">Query gen cost</div>
    <div class="card-value">${qg.get('cost_usd',0):.3f}</div>
    <div class="card-sub">{_e(qg.get('duration_s','—'))}s · {_e(qg.get('backend','—'))}</div>
  </div>
  <div class="card">
    <div class="card-label">Indexed</div>
    <div class="card-value">{_e(idx.get('sessions_indexed','—'))}</div>
    <div class="card-sub">{_e(idx.get('chunks_in_db','—'))} chunks · {_e(idx.get('duration_s','—'))}s</div>
  </div>
  <div class="card">
    <div class="card-label">Eval queries</div>
    <div class="card-value">{_e(ev.get('queries_run','—'))}</div>
    <div class="card-sub">{_e(ev.get('sessions_covered','—'))} sessions covered</div>
  </div>
</div>

<h2>Metrics</h2>
<table>
  <thead><tr><th>Metric</th><th>Value</th><th>Target</th><th>Status</th></tr></thead>
  <tbody>
    {"".join(f"<tr><td>{_e(m[0])}</td><td><strong>{_e(m[1])}</strong></td><td class='muted'>{_e(m[2])}</td><td>{BADGE[m[3]]}</td></tr>" for m in metrics)}
  </tbody>
</table>

<h2>Error Analysis</h2>
{ea_html}

<h2 style="margin-top:44px">All Queries</h2>
<details class="all-qs">
  <summary>Show all {len(qs)} results ▾</summary>
  <table style="margin-top:12px">
    <thead><tr><th>Session</th><th>Query</th><th>Found</th><th>Rank</th><th>NDCG</th><th>ms</th><th>Diagnosis</th></tr></thead>
    <tbody>{q_rows}</tbody>
  </table>
</details>

<h2 style="margin-top:44px">Run Config</h2>
<div class="config-block"><pre>{_e(json.dumps(config, indent=2))}</pre></div>

</div>
</body>
</html>"""

    out_path.write_text(out, encoding="utf-8")
    print(f"[report] → {out_path}")
