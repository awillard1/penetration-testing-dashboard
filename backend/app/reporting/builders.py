"""Report builders."""
from __future__ import annotations
import json, logging
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.config import settings
from backend.app.models.engagement import Engagement
from backend.app.models.finding import Finding
from backend.app.models.target import Target
from backend.app.models.report import Report

logger = logging.getLogger(__name__)


async def build_report(session: AsyncSession, report: Report) -> Path:
    """Build a report file and return its path."""
    fmt = report.report_format.lower()
    if fmt == "html":
        return await _build_html(session, report)
    elif fmt == "markdown":
        return await _build_markdown(session, report)
    elif fmt == "docx":
        return await _build_docx(session, report)
    elif fmt == "json":
        return await _build_json(session, report)
    else:
        return await _build_html(session, report)


async def _gather_data(session: AsyncSession, report: Report) -> dict:
    eng = (await session.execute(select(Engagement).where(Engagement.id == report.engagement_id))).scalars().first()
    findings = (await session.execute(
        select(Finding).where(Finding.engagement_id == report.engagement_id, Finding.in_report == True)
        .order_by(Finding.severity, Finding.title)
    )).scalars().all()
    targets = (await session.execute(select(Target).where(Target.engagement_id == report.engagement_id))).scalars().all()
    return {"engagement": eng, "findings": findings, "targets": targets, "report": report}


async def _build_html(session: AsyncSession, report: Report) -> Path:
    data = await _gather_data(session, report)
    eng = data["engagement"]
    findings = data["findings"]
    targets = data["targets"]

    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "informational": 4}
    findings_sorted = sorted(findings, key=lambda f: sev_order.get(f.severity, 5))

    from backend.app.reporting.html import render_html_report
    html = render_html_report(eng, findings_sorted, targets, report)
    out_dir = settings.report_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in report.title)[:64]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"{safe_title}_{timestamp}.html"
    out_path.write_text(html, encoding="utf-8")
    return out_path


async def _build_markdown(session: AsyncSession, report: Report) -> Path:
    data = await _gather_data(session, report)
    eng = data["engagement"]
    findings = data["findings"]
    from backend.app.reporting.markdown import render_markdown_report
    md = render_markdown_report(eng, findings, report)
    out_dir = settings.report_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in report.title)[:64]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"{safe_title}_{timestamp}.md"
    out_path.write_text(md, encoding="utf-8")
    return out_path


async def _build_docx(session: AsyncSession, report: Report) -> Path:
    data = await _gather_data(session, report)
    eng = data["engagement"]
    findings = data["findings"]
    from backend.app.reporting.docx_builder import render_docx_report
    out_dir = settings.report_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in report.title)[:64]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"{safe_title}_{timestamp}.docx"
    render_docx_report(eng, findings, report, out_path)
    return out_path


async def _build_json(session: AsyncSession, report: Report) -> Path:
    data = await _gather_data(session, report)
    eng = data["engagement"]
    findings = data["findings"]
    payload = {
        "engagement": {"id": eng.id, "name": eng.name} if eng else {},
        "findings": [
            {"id": f.id, "title": f.title, "severity": f.severity, "status": f.status, "description": f.description}
            for f in findings
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    out_dir = settings.report_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in report.title)[:64]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"{safe_title}_{timestamp}.json"
    out_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return out_path
