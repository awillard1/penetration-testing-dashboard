"""Pydantic schemas for all models."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator, field_serializer


# ── Client ──────────────────────────────────────────────────────────────────

class ClientContactBase(BaseModel):
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False
    notes: Optional[str] = None

class ClientContactCreate(ClientContactBase):
    pass

class ClientContactRead(ClientContactBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    client_id: str
    created_at: datetime
    updated_at: datetime

class ClientBase(BaseModel):
    name: str
    legal_name: Optional[str] = None
    abbreviation: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    is_active: bool = True

class ClientCreate(ClientBase):
    contacts: Optional[List[ClientContactCreate]] = None

class ClientUpdate(ClientBase):
    name: Optional[str] = None

class ClientRead(ClientBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    contacts: List[ClientContactRead] = []


# ── Engagement ───────────────────────────────────────────────────────────────

class EngagementBase(BaseModel):
    name: str
    identifier: Optional[str] = None
    client_id: Optional[str] = None
    description: Optional[str] = None
    engagement_type: str = "other"
    status: str = "draft"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    testing_window: Optional[str] = None
    time_zone: str = "UTC"
    primary_tester: Optional[str] = None
    scope_notes: Optional[str] = None
    out_of_scope_notes: Optional[str] = None
    rules_of_engagement: Optional[str] = None
    emergency_contacts: Optional[str] = None
    authorization_notes: Optional[str] = None
    testing_constraints: Optional[str] = None
    allowed_methods: Optional[str] = None
    prohibited_methods: Optional[str] = None
    data_handling: Optional[str] = None
    reporting_requirements: Optional[str] = None
    engagement_folder: Optional[str] = None
    tags: Optional[str] = None
    is_archived: bool = False

class EngagementCreate(EngagementBase):
    pass

class EngagementUpdate(EngagementBase):
    name: Optional[str] = None

class EngagementRead(EngagementBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ── ScopeItem ────────────────────────────────────────────────────────────────

class ScopeItemBase(BaseModel):
    engagement_id: str
    item_type: str = "other"
    value: str
    description: Optional[str] = None
    in_scope: bool = True
    testing_restrictions: Optional[str] = None
    environment: Optional[str] = None
    owner: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None

class ScopeItemCreate(ScopeItemBase):
    pass

class ScopeItemUpdate(ScopeItemBase):
    engagement_id: Optional[str] = None
    value: Optional[str] = None

class ScopeItemRead(ScopeItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ── Target ────────────────────────────────────────────────────────────────────

class TargetBase(BaseModel):
    engagement_id: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    protocol: Optional[str] = None
    url: Optional[str] = None
    operating_system: Optional[str] = None
    technology: Optional[str] = None
    environment: Optional[str] = None
    asset_owner: Optional[str] = None
    auth_required: bool = False
    creds_available: bool = False
    in_scope: bool = True
    source: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None

class TargetCreate(TargetBase):
    pass

class TargetUpdate(TargetBase):
    engagement_id: Optional[str] = None

class TargetRead(TargetBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Finding ───────────────────────────────────────────────────────────────────

class FindingBase(BaseModel):
    engagement_id: str
    finding_id: Optional[str] = None
    title: str
    summary: Optional[str] = None
    description: Optional[str] = None
    technical_details: Optional[str] = None
    severity: str = "informational"
    cvss_version: Optional[str] = None
    cvss_vector: Optional[str] = None
    cvss_score: Optional[float] = None
    risk_rating: Optional[str] = None
    cwe: Optional[str] = None
    owasp_category: Optional[str] = None
    mitre_technique: Optional[str] = None
    nist_mapping: Optional[str] = None
    cms_ars_mapping: Optional[str] = None
    affected_endpoints: Optional[str] = None
    impact: Optional[str] = None
    likelihood: Optional[str] = None
    business_impact: Optional[str] = None
    reproduction_steps: Optional[str] = None
    proof_of_concept: Optional[str] = None
    remediation: Optional[str] = None
    references: Optional[str] = None
    status: str = "draft"
    assigned_tester: Optional[str] = None
    client_owner: Optional[str] = None
    date_discovered: Optional[date] = None
    date_reported: Optional[date] = None
    date_remediated: Optional[date] = None
    retest_date: Optional[date] = None
    retest_result: Optional[str] = None
    tags: Optional[str] = None
    internal_notes: Optional[str] = None
    client_visible_notes: Optional[str] = None
    in_report: bool = True

class FindingCreate(FindingBase):
    pass

class FindingUpdate(FindingBase):
    engagement_id: Optional[str] = None
    title: Optional[str] = None

class FindingRead(FindingBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    version: int
    created_at: datetime
    updated_at: datetime


# ── FindingTemplate ──────────────────────────────────────────────────────────

class FindingTemplateBase(BaseModel):
    title: str
    category: str = "other"
    severity: str = "medium"
    cwe: Optional[str] = None
    owasp_category: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    reproduction_guidance: Optional[str] = None
    remediation: Optional[str] = None
    references: Optional[str] = None
    tags: Optional[str] = None

class FindingTemplateCreate(FindingTemplateBase):
    pass

class FindingTemplateUpdate(FindingTemplateBase):
    title: Optional[str] = None

class FindingTemplateRead(FindingTemplateBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ── Evidence ──────────────────────────────────────────────────────────────────

class EvidenceBase(BaseModel):
    engagement_id: str
    target_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    evidence_type: str = "other"
    source_tool: Optional[str] = None
    command_used: Optional[str] = None
    is_sensitive: bool = False
    in_report: bool = True
    caption: Optional[str] = None
    display_order: int = 0
    tags: Optional[str] = None
    notes: Optional[str] = None

class EvidenceCreate(EvidenceBase):
    pass

class EvidenceUpdate(EvidenceBase):
    engagement_id: Optional[str] = None
    title: Optional[str] = None

class EvidenceRead(EvidenceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    sha256: Optional[str] = None
    capture_date: Optional[datetime] = None
    captured_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Credential ────────────────────────────────────────────────────────────────

class CredentialBase(BaseModel):
    engagement_id: str
    target_id: Optional[str] = None
    username: Optional[str] = None
    domain: Optional[str] = None
    secret_type: str = "password"
    source: Optional[str] = None
    privilege_level: Optional[str] = None
    is_validated: bool = False
    is_compromised: bool = True
    is_reused: bool = False
    notes: Optional[str] = None
    tags: Optional[str] = None

class CredentialCreate(CredentialBase):
    plaintext_secret: Optional[str] = None  # encrypted before storage

class CredentialUpdate(CredentialBase):
    engagement_id: Optional[str] = None
    plaintext_secret: Optional[str] = None

class CredentialRead(CredentialBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    validation_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # encrypted_secret is never included


# ── HashRecord ────────────────────────────────────────────────────────────────

class HashRecordBase(BaseModel):
    engagement_id: str
    target_id: Optional[str] = None
    username: Optional[str] = None
    hash_type: Optional[str] = None
    hash_value: Optional[str] = None
    source_file: Optional[str] = None
    is_cracked: bool = False
    tool: Optional[str] = None
    session_name: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None

class HashRecordCreate(HashRecordBase):
    pass

class HashRecordUpdate(HashRecordBase):
    engagement_id: Optional[str] = None

class HashRecordRead(HashRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    credential_id: Optional[str] = None
    crack_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskChecklistItemBase(BaseModel):
    text: str
    is_done: bool = False
    display_order: int = 0

class TaskChecklistItemCreate(TaskChecklistItemBase):
    pass

class TaskChecklistItemRead(TaskChecklistItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    task_id: str

class TaskBase(BaseModel):
    engagement_id: str
    target_id: Optional[str] = None
    finding_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str = "backlog"
    priority: str = "normal"
    assigned_user: Optional[str] = None
    due_date: Optional[date] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    tags: Optional[str] = None

class TaskCreate(TaskBase):
    checklist_items: Optional[List[TaskChecklistItemCreate]] = None

class TaskUpdate(TaskBase):
    engagement_id: Optional[str] = None
    title: Optional[str] = None

class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    checklist_items: List[TaskChecklistItemRead] = []


# ── Note ──────────────────────────────────────────────────────────────────────

class NoteBase(BaseModel):
    engagement_id: Optional[str] = None
    target_id: Optional[str] = None
    finding_id: Optional[str] = None
    title: str
    content: Optional[str] = None
    note_type: str = "general"
    is_internal: bool = True
    tags: Optional[str] = None

class NoteCreate(NoteBase):
    pass

class NoteUpdate(NoteBase):
    title: Optional[str] = None

class NoteRead(NoteBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ── Link ──────────────────────────────────────────────────────────────────────

class LinkBase(BaseModel):
    name: str
    url: str
    category: str = "other"
    description: Optional[str] = None
    tags: Optional[str] = None
    is_favorite: bool = False
    collection_id: Optional[str] = None
    engagement_id: Optional[str] = None
    target_id: Optional[str] = None
    finding_id: Optional[str] = None
    auth_notes: Optional[str] = None
    is_sensitive: bool = False
    display_order: int = 0

class LinkCreate(LinkBase):
    pass

class LinkUpdate(LinkBase):
    name: Optional[str] = None
    url: Optional[str] = None

class LinkRead(LinkBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    last_opened: Optional[datetime] = None
    open_count: int
    created_at: datetime
    updated_at: datetime

class LinkCollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    engagement_id: Optional[str] = None
    display_order: int = 0

class LinkCollectionCreate(LinkCollectionBase):
    pass

class LinkCollectionRead(LinkCollectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    links: List[LinkRead] = []


# ── Command ───────────────────────────────────────────────────────────────────

class CommandBase(BaseModel):
    name: str
    category: str = "other"
    description: Optional[str] = None
    command_text: str
    variables: Optional[str] = None
    operating_system: str = "any"
    tool: Optional[str] = None
    tags: Optional[str] = None
    is_favorite: bool = False
    is_sensitive: bool = False
    created_by: Optional[str] = None

class CommandCreate(CommandBase):
    pass

class CommandUpdate(CommandBase):
    name: Optional[str] = None
    command_text: Optional[str] = None

class CommandRead(CommandBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    last_used: Optional[datetime] = None
    usage_count: int
    created_at: datetime
    updated_at: datetime


# ── Payload ───────────────────────────────────────────────────────────────────

class PayloadBase(BaseModel):
    name: str
    category: str = "other"
    description: Optional[str] = None
    content: str
    language: Optional[str] = None
    tags: Optional[str] = None
    is_favorite: bool = False
    is_sensitive: bool = False
    authorized_use_warning: Optional[str] = None

class PayloadCreate(PayloadBase):
    pass

class PayloadUpdate(PayloadBase):
    name: Optional[str] = None
    content: Optional[str] = None

class PayloadRead(PayloadBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    last_used: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── ActivityEvent ─────────────────────────────────────────────────────────────

class ActivityEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    engagement_id: Optional[str] = None
    actor: Optional[str] = None
    event_type: str
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info) -> str:
        # If DB value is naive, treat as UTC; always emit RFC3339 with Z
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")


# ── TimeEntry ────────────────────────────────────────────────────────────────

class TimeEntryBase(BaseModel):
    engagement_id: str
    task_id: Optional[str] = None
    finding_id: Optional[str] = None
    category: str = "testing"
    description: Optional[str] = None
    is_billable: bool = True
    duration_minutes: Optional[int] = None

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(TimeEntryBase):
    engagement_id: Optional[str] = None

class TimeEntryRead(TimeEntryBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ── ScanImport ────────────────────────────────────────────────────────────────

class ScanImportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    engagement_id: str
    filename: str
    scan_type: str
    status: str
    sha256: Optional[str] = None
    imported_targets: int
    imported_findings: int
    error_count: int
    imported_at: Optional[datetime] = None
    created_at: datetime


# ── Report ────────────────────────────────────────────────────────────────────

class ReportBase(BaseModel):
    engagement_id: str
    title: str
    report_format: str = "html"
    notes: Optional[str] = None

class ReportCreate(ReportBase):
    config_json: Optional[str] = None

class ReportRead(ReportBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    is_draft: bool
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Backup ────────────────────────────────────────────────────────────────────

class BackupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    filename: str
    file_size: Optional[int] = None
    sha256: Optional[str] = None
    backup_type: str
    is_encrypted: bool
    is_verified: bool
    notes: Optional[str] = None
    created_at: datetime


# ── WatchPath ─────────────────────────────────────────────────────────────────

class WatchPathBase(BaseModel):
    name: str
    path: str
    category: str = "custom"
    is_recursive: bool = True
    is_enabled: bool = True
    engagement_id: Optional[str] = None
    file_patterns: Optional[str] = None
    ignore_patterns: Optional[str] = None

class WatchPathCreate(WatchPathBase):
    pass

class WatchPathUpdate(WatchPathBase):
    name: Optional[str] = None
    path: Optional[str] = None

class WatchPathRead(WatchPathBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    last_event: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ── ApplicationSetting ────────────────────────────────────────────────────────

class SettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    key: str
    value: Optional[str] = None
    description: Optional[str] = None
    setting_type: str


# ── Dashboard Summary ─────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    active_engagement: Optional[EngagementRead] = None
    total_targets: int = 0
    total_hosts: int = 0
    total_services: int = 0
    total_endpoints: int = 0
    tested_endpoints: int = 0
    total_findings: int = 0
    findings_by_severity: dict[str, int] = {}
    findings_by_status: dict[str, int] = {}
    open_tasks: int = 0
    evidence_count: int = 0
    credential_count: int = 0
    valid_credential_count: int = 0
    scan_count: int = 0
    coverage_percent: float = 0.0
    pending_retests: int = 0
    pending_evidence: int = 0
    pending_review: int = 0
    running_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    stopped_jobs: int = 0
    untested_endpoints: int = 0
    day_counter: int = 0
    recent_activity: List[ActivityEventRead] = []


# ── Search ────────────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    entity_type: str
    id: str
    title: str
    subtitle: Optional[str] = None
    engagement_id: Optional[str] = None
    url: Optional[str] = None
