"""Finding, FindingTarget, FindingEvidence, FindingTemplate models."""
from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class Finding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "findings"

    engagement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("engagements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finding_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    technical_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(
        String(32), default="informational", nullable=False, index=True
    )
    cvss_version: Mapped[str | None] = mapped_column(String(8), nullable=True)
    cvss_vector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cvss_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_rating: Mapped[str | None] = mapped_column(String(32), nullable=True)
    cwe: Mapped[str | None] = mapped_column(String(32), nullable=True)
    owasp_category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    mitre_technique: Mapped[str | None] = mapped_column(String(128), nullable=True)
    nist_mapping: Mapped[str | None] = mapped_column(Text, nullable=True)
    cms_ars_mapping: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_endpoints: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    likelihood: Mapped[str | None] = mapped_column(String(32), nullable=True)
    business_impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    reproduction_steps: Mapped[str | None] = mapped_column(Text, nullable=True)
    proof_of_concept: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediation: Mapped[str | None] = mapped_column(Text, nullable=True)
    references: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="draft", nullable=False, index=True)
    assigned_tester: Mapped[str | None] = mapped_column(String(128), nullable=True)
    client_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    date_discovered: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_reported: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_remediated: Mapped[date | None] = mapped_column(Date, nullable=True)
    retest_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    retest_result: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_visible_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    in_report: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)

    engagement: Mapped["Engagement"] = relationship("Engagement", back_populates="findings")
    finding_targets: Mapped[list[FindingTarget]] = relationship(
        "FindingTarget", back_populates="finding", cascade="all, delete-orphan"
    )
    finding_evidence: Mapped[list[FindingEvidence]] = relationship(
        "FindingEvidence", back_populates="finding", cascade="all, delete-orphan"
    )


class FindingTarget(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "finding_targets"

    finding_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True
    )

    finding: Mapped[Finding] = relationship("Finding", back_populates="finding_targets")
    target: Mapped["Target"] = relationship("Target", back_populates="finding_targets")


class FindingEvidence(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "finding_evidence"

    finding_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    finding: Mapped[Finding] = relationship("Finding", back_populates="finding_evidence")
    evidence: Mapped["Evidence"] = relationship("Evidence", back_populates="finding_evidence")


class FindingTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "finding_templates"

    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(64), default="other", nullable=False)
    severity: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)
    cwe: Mapped[str | None] = mapped_column(String(32), nullable=True)
    owasp_category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    reproduction_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediation: Mapped[str | None] = mapped_column(Text, nullable=True)
    references: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
