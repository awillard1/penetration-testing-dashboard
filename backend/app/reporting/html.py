"""HTML report renderer."""
from __future__ import annotations
from datetime import datetime, timezone
from html import escape

SEV_COLORS = {
    "critical": "#dc2626",
    "high": "#ea580c",
    "medium": "#d97706",
    "low": "#2563eb",
    "informational": "#6b7280",
}


def render_html_report(eng, findings, targets, report) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = escape(report.title)
    eng_name = escape(eng.name if eng else "Unknown Engagement")
    draft_banner = '<div style="background:#fbbf24;color:#000;text-align:center;padding:8px;font-weight:bold;">DRAFT – Not for Distribution</div>' if report.is_draft else ""

    finding_rows = []
    for i, f in enumerate(findings, 1):
        color = SEV_COLORS.get(f.severity, "#6b7280")
        finding_rows.append(f"""
        <tr>
          <td style="padding:8px;border:1px solid #374151">{i}</td>
          <td style="padding:8px;border:1px solid #374151">{escape(f.title)}</td>
          <td style="padding:8px;border:1px solid #374151"><span style="background:{color};color:#fff;padding:2px 8px;border-radius:4px">{escape(f.severity.upper())}</span></td>
          <td style="padding:8px;border:1px solid #374151">{escape(f.status)}</td>
        </tr>""")

    finding_details = []
    for i, f in enumerate(findings, 1):
        color = SEV_COLORS.get(f.severity, "#6b7280")
        finding_details.append(f"""
        <div style="border:1px solid #374151;border-radius:8px;margin-bottom:24px;padding:16px">
          <h3 style="margin:0 0 8px 0">F{i:03d} – {escape(f.title)}
            <span style="background:{color};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.8em;margin-left:8px">{escape(f.severity.upper())}</span>
          </h3>
          {'<p><strong>Description:</strong><br>' + escape(f.description or '') + '</p>' if f.description else ''}
          {'<p><strong>Impact:</strong><br>' + escape(f.impact or '') + '</p>' if f.impact else ''}
          {'<p><strong>Reproduction Steps:</strong><br>' + escape(f.reproduction_steps or '') + '</p>' if f.reproduction_steps else ''}
          {'<p><strong>Remediation:</strong><br>' + escape(f.remediation or '') + '</p>' if f.remediation else ''}
          {'<p><strong>Affected Endpoints:</strong><br>' + escape(f.affected_endpoints or '') + '</p>' if f.affected_endpoints else ''}
        </div>""")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#111827; color:#f9fafb; margin:0; padding:0; }}
    .container {{ max-width:900px; margin:0 auto; padding:40px 20px; }}
    table {{ border-collapse:collapse; width:100%; margin-bottom:16px; }}
    th {{ background:#1f2937; padding:8px; border:1px solid #374151; text-align:left; }}
  </style>
</head>
<body>
{draft_banner}
<div class="container">
  <h1 style="color:#f59e0b">{title}</h1>
  <p style="color:#9ca3af">Engagement: {eng_name} &bull; Generated: {now}</p>
  <hr style="border-color:#374151">
  <h2>Finding Summary</h2>
  <table>
    <thead><tr><th>#</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
    <tbody>{"".join(finding_rows)}</tbody>
  </table>
  <h2>Detailed Findings</h2>
  {"".join(finding_details) if finding_details else '<p style="color:#6b7280">No findings included in this report.</p>'}
  <hr style="border-color:#374151">
  <p style="color:#6b7280;text-align:center">PentestDashboard &bull; {now}</p>
</div>
</body>
</html>"""
