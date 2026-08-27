# Implementation Gap Audit

Status legend:
- COMPLETE
- PARTIAL
- MISSING
- BROKEN
- BACKEND ONLY
- FRONTEND ONLY

## Major Feature Classification

| Feature | Status | Notes |
|---|---|---|
| Engagement CRUD and summaries | PARTIAL | Detail editing improved; readiness/closeout and richer operational views still pending |
| Target workspace breadth | PARTIAL | Expanded multi-tab work surface exists; several advanced tabs still need deeper domain workflows |
| Target overview operational density | PARTIAL | Identity/surface/testing/security/ops now surfaced; needs broader live correlation metrics |
| Site map | PARTIAL | Hierarchical map + filters + click-through added; request/evidence counters and role-tested facets incomplete |
| Endpoint detail workspace | PARTIAL | Implemented detail + related objects + edit controls; advanced auth/ownership matrix remains incomplete |
| HTTP workbench | PARTIAL | Multi-view inspector with copy actions exists; advanced extraction/compare workflows remain incomplete |
| Evidence workflow | PARTIAL | Core file lifecycle works; deeper cross-associations beyond findings still incomplete |
| Credentials in target context | PARTIAL | Target credential tab and usage records visible; richer associate actions still pending |
| Service-centric credential test records | PARTIAL | CredentialUsage model/API/UI present; full matrix actions and role workflows pending |
| Runner architecture (external process ownership) | PARTIAL | Dashboard now queues jobs and runner service claims/executes; multi-runner reconciliation hardening still pending |
| Runner auth and registry | PARTIAL | Runner registration/token/heartbeat/revoke implemented; user/role restrictions pending |
| Live output streaming | PARTIAL | SSE stream endpoint + Jobs live updates added; artifactized large-output storage still pending |
| Tool inventory / doctor | PARTIAL | Runner tool detection and settings visibility added; deep health/outdated checks pending |
| Tool installation scripts | PARTIAL | Linux/Windows check/install scripts added with grouped flags; expanded distro nuances pending |
| Burp extension | PARTIAL | Gradle Montoya extension scaffold + tab/context menu built; full production protocol alignment pending |
| Recon page | MISSING | Dedicated recon page and snapshot diff UI not yet completed |
| Recon diff + snapshots | MISSING | Snapshot persistence/change visualization not implemented yet |
| Dashboard command-center rebuild | PARTIAL | Operational improvements exist; full panel set and My Work queue unification pending |
| My Work queue | MISSING | Unified prioritized queue not fully implemented |
| Screenshot editor UI | BACKEND ONLY | Metadata model exists; full editor UX still missing |
| Loot/artifact workspace | MISSING | No dedicated operator surface yet |
| Attack path UI | BACKEND ONLY | Models exist; graph/list UX still missing |
| Foothold/access workspace | BACKEND ONLY | Models exist; dedicated workflows still missing |
| Engagement timeline page | PARTIAL | Activity timeline exists; full merged-event timeline and filters pending |
| Global search / command palette | PARTIAL | Header search exists; full Ctrl+K command palette UX still pending |
| Global quick capture | MISSING | Dedicated quick capture menu/shortcuts incomplete |
| Cracking dashboard | BACKEND ONLY | hash/session-related models exist; page/workflow missing |
| Authentication | MISSING | Dashboard still lacks complete login/session/RBAC enforcement |
| RBAC | MISSING | Role checks for reveal/override/admin features pending |
| Alembic migration discipline | MISSING | Runtime create_all still active and migration history not fully established |

## Follow-up Priority (remaining)
1. Complete auth + RBAC
2. Recon page + snapshots + diffs
3. My Work queue and dashboard panel completion
4. Loot, screenshot editor, attack paths, footholds UIs
5. Runner output artifactization and reconciliation hardening
6. Burp extension protocol hardening + production endpoint parity
