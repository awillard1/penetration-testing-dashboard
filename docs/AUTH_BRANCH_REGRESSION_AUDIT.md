# Auth Branch Regression Audit

| Feature | Expand | Auth branch | Status | Fix |
|---|---|---|---|---|
| Login, token refresh, bearer middleware | Not present | Present | PRESERVED | Kept auth routes, middleware, token storage, and bootstrap admin flow. |
| Findings RBAC for client users | Partial | Present | PRESERVED | Kept authenticated findings access plus client scoping/redaction. |
| `/workspace/:id` target workspace | Present | Missing | RESTORED | Restored route, page, operator API client, backend operator router, models, and services. |
| `/my-work` | Present | Missing | RESTORED | Restored page and operator-only route guard. |
| `/testing` | Present | Missing | RESTORED | Restored page and operator-only route guard. |
| `/recon` | Present | Missing | RESTORED | Restored page, operator API methods, and backend recon endpoints. |
| `/jobs` | Present | Missing | RESTORED | Restored page, route, operator jobs APIs, and backend job routes. |
| `/runners` | Present | Missing | RESTORED | Restored runner UI, client APIs, backend runner routes, models, and runner-auth bypass in middleware. |
| `/review` | Present | Missing | RESTORED | Restored review route with reviewer/operator access. |
| Workflow-oriented sidebar | Present | Simplified / client-only hiding | RESTORED | Rebuilt sectioned navigation with capability-based visibility. |
| Central capability model | Absent | Absent | RESTORED | Added `frontend/src/lib/capabilities.ts` and replaced route/nav role branching with named checks. |
| Operator API surface | Present | Missing | RESTORED | Restored `operatorApi` methods for workspace, methodology, jobs, commands, HTTP, recon, and endpoint detail. |
| Evidence detail / preview / file / attach | Present | Missing | RESTORED | Restored backend evidence detail, preview, file, attach, and detach endpoints plus client helpers. |
| Scans detail / update | Present | Missing | RESTORED | Restored backend scan detail/update endpoints and client helpers. |
| Backend operator router | Present | Missing | RESTORED | Re-added `/api/v1/operator` with staff-only RBAC. |
| Backend runners router | Present | Missing | RESTORED | Re-added `/api/v1/runners` management endpoints with staff RBAC and runner header auth. |
| README coverage for expand workflows + auth | Present | Partial | RESTORED | Updated docs to cover restored workflows and auth/RBAC expectations. |
| Restored features under auth shell | n/a | Mixed | AUTH-BROKEN | Repaired by merging expand functionality into auth-aware routes, nav, APIs, and middleware. |
