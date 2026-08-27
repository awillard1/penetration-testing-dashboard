# Operator Gap Analysis

## Audit Scope
Complete audit of frontend pages, backend API routes, schemas, models, and cross-entity relationships for:
engagements, clients, targets, hosts, services, endpoints, parameters, findings, evidence, screenshots, credentials, notes, tasks, commands, payloads, scans, jobs, HTTP messages, methodology, footholds, reports, links/resources, activity events, files/artifacts.

## Audit Matrix (UI-Meaningful Workflow)

| Entity/Page | Existing Capabilities | Gaps Found During Audit |
|---|---|---|
| Clients | Create/list/delete backend support | No dedicated detail workflow in UI; weak relationship navigation to engagements |
| Engagements | List/create + summary | Detail page was mostly read-only and lacked full edit lifecycle |
| Targets | CRUD + workspace entry | Some edits still modal-heavy and not inline for fast operator workflows |
| Findings | Good list + detail edit/delete | Needs deeper cross-entity quick-create paths from more surfaces |
| Evidence | Now strong detail/preview/download/edit/delete + finding association | Additional cross-association targets still pending (endpoint/methodology/credential/job/scan) |
| Credentials | Create/list/reveal/delete | Missing robust edit/manage flow and confirmations (fixed in this iteration) |
| Notes | Create/edit/delete usable | Could use richer link/pivoting from related entities |
| Tasks | CRUD and status updates | Checklist/deep workflow still limited |
| Commands/Payloads | CRUD and usage tracking | Could add richer operator pivots to jobs/findings |
| Scans | Upload/list/delete | Missing operator detail/review flow for import outcomes and errors (fixed in this iteration) |
| Jobs | Basic status table | Missing actionable stop/detail/stdout-stderr workflow (fixed in this iteration) |
| Activity | Read-only timeline list | Needs stronger filtering and direct related-object navigation |
| Reports | Generate/list/download/delete | Limited review/regeneration workflow |

## Earlier Remediation (Completed)
- Evidence security and usability upgrades:
  - secure path resolution under configured evidence directory
  - `/api/v1/evidence/{id}/file` inline/download + HTTP Range
  - `/api/v1/evidence/{id}/detail` and `/api/v1/evidence/{id}/preview`
  - evidence↔finding attach/detach endpoints
  - rebuilt Evidence UI list+detail with metadata editing, preview, and download

## This Iteration Remediation (Completed)

### 1) Engagement Detail CRUD Usability
- Rebuilt engagement detail into full operator edit workflow:
  - View/Edit/Save/Cancel
  - Delete with confirmation
  - Success/error notifications
  - Editable status/type/dates/tester/scope/ROE/authorization notes

### 2) Credentials Operational Manageability
- Upgraded credentials page with:
  - search/filter
  - edit modal for metadata and validation state
  - delete confirmation
  - explicit reveal + copy behavior
  - improved timestamps/visibility of record state

### 3) Scans Detail and Import Review Flow
- Added backend scan detail and update capabilities:
  - `GET /api/v1/scans/{id}/detail` (metadata, error log, parsed results)
  - `PATCH /api/v1/scans/{id}` (notes update)
- Rebuilt scan UI with clickable rows and detail modal:
  - parsed result visibility
  - error log visibility
  - notes edit/save
  - delete with confirmation

### 4) Jobs Console Usability
- Rebuilt jobs page to support meaningful operator control:
  - status filters + text search
  - row detail modal
  - stdout/stderr visibility
  - explicit stop action for running jobs
  - ongoing refresh for live operations

## Remaining High-Priority Gaps
1. Complete deep association workflows from evidence to endpoint/methodology/credential/job/scan.
2. Expand target workspace tabs into fully editable high-density operational surfaces for all requested domains.
3. Strengthen global search/command palette and quick capture coverage.
4. Add stronger activity timeline filtering and related-object drill-through.
5. Improve report review/retest workflows and advanced correlation surfaces.

## Acceptance Workflow Impact
This pass removes several major dead ends in day-to-day operation by making engagements, credentials, scans, and jobs materially actionable in-place, reducing context switches and external tooling.
