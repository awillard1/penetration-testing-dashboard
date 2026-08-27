# Architecture

## Overview
The application is a local-first pentest operations platform with:
- **Backend:** FastAPI + async SQLAlchemy
- **Frontend:** React + TypeScript + React Query
- **Data:** relational models for engagements, inventory, findings, evidence, credentials, scans, jobs, and operator metadata

## Backend Structure
- `backend/app/models/`: core entities and operator extensions.
- `backend/app/api/`: resource routes + operator workflows.
- `backend/app/integrations/`: scan/Burp import normalization.
- `backend/app/services/`: operator utilities (normalization, command safety, workspace support).

### Key Operational Domains
1. Engagement context and scope
2. Target-centric inventory hierarchy
3. Findings/evidence lifecycle
4. Methodology coverage tracking
5. Command execution and job history
6. Import correlation and provenance

## Frontend Structure
- `frontend/src/pages/`: operator pages (dashboard, workspace, jobs, findings, evidence, etc.)
- `frontend/src/components/`: reusable UI primitives/layout
- `frontend/src/api/client.ts`: API bindings
- `frontend/src/utils/`: command-center transformations/metrics

## Data & Relationship Model (Current)
- Engagement anchors most operational records.
- Targets relate to inventory entities and findings/evidence/jobs.
- Findings and evidence are linked via association table.
- Operator models extend to methodology, HTTP messages, command runs, and foothold/attack-path foundations.

## Security Controls
- Evidence file retrieval resolves only within configured attachment directory.
- File serving supports explicit inline/download disposition.
- Command execution requires explicit operator confirmation and scope checks.
- Sensitive fields (credentials) use masked-by-default patterns.

## Current Architectural Direction
1. **Operator cockpit UX:** persistent engagement context + dense actionable dashboard.
2. **Target workspace first:** make target page the central work surface.
3. **Correlation-first ingest:** unify discoveries across tools while retaining provenance.
4. **Safe-by-default execution:** explicit human-in-the-loop command control.

## Near-Term Evolution
- Complete CRUD/detail parity across all operator entities.
- Expand evidence/HTTP inspector and cross-entity associations.
- Strengthen timeline/retest/attack-path workflows.
- Broaden automated test coverage for operator interactions.
