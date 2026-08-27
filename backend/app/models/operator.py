"""Operator workspace and execution models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base, TimestampMixin, UUIDMixin


class AssetHost(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "asset_hosts"
    __table_args__ = (UniqueConstraint("engagement_id", "hostname", "ip_address", name="uq_asset_host"),)

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    operating_system: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discovered_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class AssetService(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "asset_services"
    __table_args__ = (UniqueConstraint("host_id", "port", "protocol", "service_name", name="uq_asset_service"),)

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    host_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("asset_hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protocol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    service_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    banner: Mapped[str | None] = mapped_column(Text, nullable=True)
    technology: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discovered_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class AssetUrl(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "asset_urls"
    __table_args__ = (UniqueConstraint("host_id", "url", name="uq_asset_url"),)

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    host_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("asset_hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("asset_services.id", ondelete="SET NULL"), nullable=True, index=True
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discovered_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class AssetEndpoint(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "asset_endpoints"
    __table_args__ = (UniqueConstraint("url_id", "method", "path", name="uq_asset_endpoint"),)

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    host_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("asset_hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("asset_services.id", ondelete="SET NULL"), nullable=True, index=True
    )
    url_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("asset_urls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(String(16), default="GET", nullable=False, index=True)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    query_params: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_params: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auth_requirement: Mapped[str | None] = mapped_column(String(64), nullable=True)
    testing_status: Mapped[str] = mapped_column(String(32), default="not_tested", nullable=False, index=True)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discovered_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provenance_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class EndpointParameter(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "endpoint_parameters"
    __table_args__ = (UniqueConstraint("endpoint_id", "location", "name", name="uq_endpoint_parameter"),)

    endpoint_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("asset_endpoints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location: Mapped[str] = mapped_column(String(32), default="query", nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sample_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discovered_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MethodologyProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "methodology_profiles"

    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class MethodologyItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "methodology_items"

    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("methodology_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    guidance: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class MethodologyResult(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "methodology_results"
    __table_args__ = (UniqueConstraint("target_id", "item_id", name="uq_methodology_target_item"),)

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("methodology_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("methodology_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="not_tested", nullable=False, index=True)
    finding_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    evidence_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CommandRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "command_runs"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    command_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("commands.id", ondelete="SET NULL"), nullable=True, index=True
    )
    template_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    execution_profile: Mapped[str] = mapped_column(String(32), default="linux", nullable=False)
    command_preview: Mapped[str] = mapped_column(Text, nullable=False)
    command_executed: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    runner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("runner_nodes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    runner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout: Mapped[str | None] = mapped_column(Text, nullable=True)
    stderr: Mapped[str | None] = mapped_column(Text, nullable=True)
    stdout_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    stderr_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    stdout_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stderr_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout_tail: Mapped[str | None] = mapped_column(Text, nullable=True)
    stderr_tail: Mapped[str | None] = mapped_column(Text, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    runtime_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    working_directory: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    output_location: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    explicit_confirmation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scope_warning: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scope_override_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    stop_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class HttpMessage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "http_messages"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    endpoint_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("asset_endpoints.id", ondelete="SET NULL"), nullable=True, index=True
    )
    method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    request_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_pretty: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_pretty: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_redacted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ScreenshotAnnotation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "screenshot_annotations"

    evidence_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True
    )
    edited_evidence_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True, index=True
    )
    annotation_json: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class CredentialUsage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "credential_usages"

    credential_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("credentials.id", ondelete="CASCADE"), nullable=False, index=True
    )
    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    host_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("asset_hosts.id", ondelete="SET NULL"), nullable=True
    )
    service_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("asset_services.id", ondelete="SET NULL"), nullable=True
    )
    endpoint_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("asset_endpoints.id", ondelete="SET NULL"), nullable=True
    )
    usage_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    validation_state: Mapped[str] = mapped_column(String(32), default="unknown", nullable=False)
    last_validation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FindingDuplicateCandidate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "finding_duplicate_candidates"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    finding_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_finding_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fingerprint: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="candidate", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class AttackRelationship(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attack_relationships"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    relation: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    provenance: Mapped[str | None] = mapped_column(Text, nullable=True)


class AttackChain(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attack_chains"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity_uplift: Mapped[str | None] = mapped_column(String(32), nullable=True)


class AttackChainStep(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attack_chain_steps"

    chain_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("attack_chains.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    finding_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    evidence_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class FootholdSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "foothold_sessions"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_context: Mapped[str | None] = mapped_column(String(255), nullable=True)
    privilege_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    originating_finding_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    credential_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("credentials.id", ondelete="SET NULL"), nullable=True
    )
    acquired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cleanup_status: Mapped[str] = mapped_column(String(64), default="pending", nullable=False)
    cleanup_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EngagementChecklistItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "engagement_checklist_items"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    checklist_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ReconSnapshot(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "recon_snapshots"

    engagement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("command_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )


class ReconSnapshotItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "recon_snapshot_items"
    __table_args__ = (UniqueConstraint("snapshot_id", "entity_type", "normalized_key", name="uq_snapshot_entity"),)

    snapshot_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("recon_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    normalized_key: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    display_value: Mapped[str] = mapped_column(Text, nullable=False)
    source_tool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_job_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("command_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
