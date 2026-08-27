# Burp Extension (Montoya API)

This directory contains a Gradle Java Burp Suite extension that adds:

- A **PT Dashboard** Burp tab for API configuration/logging
- A context menu with required actions:
  - Send selected request/response to dashboard
  - Send selected request/response directly to a finding
  - Create finding from Burp issue
  - Retrieve engagement scope from dashboard
  - Send screenshot and notes from Burp

## Build

From repository root:

```bash
./integrations/burp-extension/gradlew -p integrations/burp-extension clean jar
```

Built JAR:

```text
integrations/burp-extension/build/libs/burp-dashboard-extension-0.1.0.jar
```

## Load in Burp Suite

1. Open **Extensions** → **Installed** → **Add**.
2. Extension type: **Java**.
3. Select the built JAR.
4. Burp class name: `com.pentestdashboard.burp.PenTestDashboardExtension`.

## Configure in Burp Tab

In the **PT Dashboard** tab, set:

- Dashboard base URL (default `http://127.0.0.1:8000`)
- API bearer token
- Engagement ID
- Target ID
- Optional default Finding ID

## API Notes

Implemented endpoint call:

- `POST /api/operator/integrations/burp/ingest`

Placeholder endpoints (adjust to your backend contract):

- `POST /api/operator/integrations/burp/send-to-finding`
- `POST /api/findings/from-burp-issue`
- `GET /api/engagements/{engagement_id}/scope`
- `POST /api/operator/integrations/burp/screenshot-notes`

The code is compile-ready and intentionally keeps these calls as straightforward placeholders for dashboard API integration.
