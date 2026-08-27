"""Model package – import all models so SQLAlchemy registers them."""
from backend.app.models.activity import ActivityEvent
from backend.app.models.backup import Backup
from backend.app.models.client import Client, ClientContact
from backend.app.models.command import Command
from backend.app.models.credential import Credential, HashRecord
from backend.app.models.engagement import Engagement, EngagementMember
from backend.app.models.evidence import Evidence
from backend.app.models.finding import Finding, FindingEvidence, FindingTarget, FindingTemplate
from backend.app.models.link import Link, LinkCollection
from backend.app.models.note import Note
from backend.app.models.payload import Payload
from backend.app.models.refresh_token import RefreshToken
from backend.app.models.report import Report
from backend.app.models.scan import ScanImport, ScanResult
from backend.app.models.scope import ScopeItem
from backend.app.models.setting import ApplicationSetting
from backend.app.models.tag import EntityTag, Tag
from backend.app.models.target import Target
from backend.app.models.task import Task, TaskChecklistItem
from backend.app.models.time_entry import TimeEntry
from backend.app.models.user import User
from backend.app.models.watch_path import WatchPath

__all__ = [
    "ActivityEvent",
    "Backup",
    "Client",
    "ClientContact",
    "Command",
    "Credential",
    "Engagement",
    "EngagementMember",
    "Evidence",
    "Finding",
    "FindingEvidence",
    "FindingTarget",
    "FindingTemplate",
    "HashRecord",
    "Link",
    "LinkCollection",
    "Note",
    "Payload",
    "RefreshToken",
    "Report",
    "ScanImport",
    "ScanResult",
    "ScopeItem",
    "ApplicationSetting",
    "EntityTag",
    "Tag",
    "Target",
    "Task",
    "TaskChecklistItem",
    "TimeEntry",
    "User",
    "WatchPath",
]
