"""Markdown report renderer."""
from __future__ import annotations
from datetime import datetime, timezone


def render_markdown_report(eng, findings, report) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    eng_name = eng.name if eng else "Unknown Engagement"
    lines = [f"# {report.title}", "", f"**Engagement:** {eng_name}  ", f"**Generated:** {now}", ""]
    if report.is_draft:
        lines.extend(["---", "> ⚠️ **DRAFT – Not for Distribution**", "---", ""])
    lines.append("## Finding Summary\n")
    lines.append("| # | Title | Severity | Status |")
    lines.append("|---|-------|----------|--------|")
    for i, f in enumerate(findings, 1):
        lines.append(f"| {i} | {f.title} | {f.severity.upper()} | {f.status} |")
    lines.append("")
    lines.append("## Detailed Findings\n")
    for i, f in enumerate(findings, 1):
        lines.append(f"### F{i:03d} – {f.title}")
        lines.append(f"**Severity:** {f.severity.upper()}  **Status:** {f.status}")
        lines.append("")
        if f.description:
            lines.append(f"**Description:**\n{f.description}\n")
        if f.impact:
            lines.append(f"**Impact:**\n{f.impact}\n")
        if f.reproduction_steps:
            lines.append(f"**Reproduction Steps:**\n{f.reproduction_steps}\n")
        if f.remediation:
            lines.append(f"**Remediation:**\n{f.remediation}\n")
        lines.append("---")
    return "\n".join(lines)
