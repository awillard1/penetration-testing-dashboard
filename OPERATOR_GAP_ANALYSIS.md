# Operator Gap Analysis

## Audit Scope
Full audit of backend models/routes and frontend pages/components covering:
engagements, clients, targets, hosts/services/endpoints/parameters, findings, evidence, screenshots, credentials, notes, tasks, commands, payloads, scans, jobs, HTTP messages, methodology, footholds, reports, links/resources, activity/audit events, files/artifacts, and cross-entity relationships.

## Summary
The project now has strong foundations for operator workflows (workspace aggregation, command execution controls, jobs, methodology, ingest normalization), but still had critical usability gaps where records were difficult to act on end-to-end in the UI.

## High-Priority Gaps Found

### 1) Evidence Lifecycle Was Incomplete
- Evidence list existed, but detail-level operation was limited.
- Weak support for inline preview/download/open from operator flow.
- Minimal association workflows from evidence to findings/targets.
- No unified detail pane for metadata edit + preview + navigation.

### 2) CRUD Consistency Gaps Across Pages
- Several pages mixed list-only and modal-only patterns, causing dead-end navigation.
- Inconsistent row click behavior and missing “open detail” paths.
- Not all mutations surfaced explicit error feedback.

### 3) Relationship Navigation Gaps
- Cross-linking between findings/evidence/targets/jobs/scans was uneven.
- Related-object traversal required too much page switching in some paths.

### 4) Preview/Artifact Usability Gaps
- Text artifact handling lacked operator-friendly pretty/raw workflows.
- No consistent handling for preview fallback on unsupported binaries.

### 5) Security/Delivery Gaps for File Retrieval
- Needed stronger documented guarantees around safe file resolution and path constraints.
- Range-friendly delivery and explicit disposition control needed to support larger artifacts and embedded previews.

## Gap Remediation Implemented In This Iteration

### Evidence Backend
- Added secure file resolution guardrails under configured evidence directory.
- Added `/api/v1/evidence/{id}/file` with inline/download behavior and Range support.
- Added `/api/v1/evidence/{id}/detail` for operator-centric metadata + association state.
- Added `/api/v1/evidence/{id}/preview` for image/pdf/text/binary preview classification.
- Added evidence↔finding association endpoints (attach/detach).
- Added search query support to evidence listing.

### Evidence Frontend
- Rebuilt Evidence page as list + detail work surface.
- Added clickable rows, detail editor, save/delete with confirmation.
- Added inline preview experience (image, PDF, text pretty/raw, binary fallback).
- Added download/open/copy-ID actions.
- Added finding association attach/detach from evidence detail panel.
- Added explicit toast error handling for create/update/delete/association failures.

## Remaining Gaps (Next Iterations)
- Broader entity-by-entity CRUD parity pass (especially deep detail/edit patterns for all operator entities).
- Full target-centric operational tabs for every requested domain (loot/files, footholds, attack paths, etc.) with complete editability.
- Unified global command palette/search and quick capture depth expansion.
- Complete recon diff workflow and stronger per-link provenance visualization.
- More complete retest and reviewer workflow UI.
- Broader test expansion for all new operator pages and association flows.

## Acceptance Workflow Impact
This iteration directly improves the critical workflow segment:
- upload evidence → open/preview/download evidence → edit metadata → associate to finding → navigate related objects,
reducing dead ends and external-tool dependence in daily testing operations.
