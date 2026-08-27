# Penetration Testing Dashboard — Product Specification

## Product Goal
Operate as a daily penetration-testing command center that minimizes context switching away from the dashboard.

## Core Principles
1. Operator-first workflows over CRUD-only pages.
2. Secure-by-default handling of credentials, evidence, and execution.
3. Explicit operator control for any command/tool execution.
4. Correlated asset model with provenance retained for every discovery.
5. A feature is complete only when operators can use it end-to-end in the UI.

## Required Capability Areas
- Engagement and scope management
- Target-centric workspace (hosts/services/URLs/endpoints/parameters)
- HTTP request/response workbench
- Evidence management (preview/download/edit/associations)
- Findings workflow and retesting
- Credential vault + per-service validation tracking
- Methodology and coverage matrix (including untested views)
- Recon ingestion, correlation, and diff/snapshots
- Durable external runner architecture
- Jobs console with live output streaming
- Burp Suite integration via extension + ingest protocol
- Attack paths and foothold tracking
- Timeline and daily operational closeout
- Global search and quick-capture workflows
- Authentication and role-based authorization

## Execution Architecture
- Dashboard API/UI handles persistence, authorization, workflow control, and visualization.
- Runner service handles process execution, lifecycle, output capture, and tool detection.
- Burp extension handles operator-initiated traffic transfer and context actions.

## Security Requirements
- Secret masking by default with explicit reveal controls
- Scope checks and override auditing
- Safe file retrieval and anti-traversal controls
- Secure runner token lifecycle (generate/revoke/never log plaintext)
- Restrict privileged actions by role

## Data Evolution Requirements
- Use Alembic migrations for schema evolution.
- Preserve existing engagement/evidence/credential/finding history.

## Test Requirements
- Backend: pytest coverage for CRUD, relationships, and security-sensitive paths
- Frontend: interaction and navigation tests for operator workflows
- Runner: lifecycle + reconciliation + tool detection tests
- Burp extension: Gradle tests/build verification

## Acceptance Baseline
The product is acceptable only when a tester can execute engagement workflows (scope → recon → HTTP analysis → evidence → findings → credentials → jobs → retest → reporting) without dead-end screens, inaccessible artifacts, or API-only functionality.
